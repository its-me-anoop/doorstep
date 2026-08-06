/**
 * DrainOutbox — the use case behind the (later) POST/GET
 * /api/cron/outbox-drain route: PRD §8.6's "a Vercel Cron worker drains
 * the outbox every minute, upserting or deleting documents in
 * Meilisearch."
 *
 * Per-entry resolution (`op` from the outbox row vs. the listing's
 * *current* status):
 *
 *  - `op: 'delete'` — deleted directly. No listing lookup at all: a
 *    delete is safe to issue against a document that may already be gone
 *    from the index, so there is nothing to check first.
 *  - `op: 'upsert'` — the listing is loaded and re-mapped fresh (reusing
 *    services/search's phase-1 mapListingToSearchDocument) rather than
 *    trusting that "upsert" is still the right action. If the listing has
 *    since been hidden, completed, or hard-deleted, mapListingToSearch-
 *    Document's own NotIndexableListingError guard fires (or the listing
 *    is simply absent) and this entry is redirected to a delete instead
 *    — "the listing is now hidden/deleted" — rather than trusting a
 *    possibly-stale `op` value that was correct when the row was
 *    enqueued but may no longer be by the time the drain worker gets to
 *    it a minute (or, after a lease expiry retry, longer) later.
 *
 * When a batch has more than one row for the same property (e.g. it was
 * published, then immediately hidden, before this minute's drain ran),
 * the entries are applied in claimed (oldest-enqueued-first) order and
 * the LAST one for that property wins — matching "the current truth",
 * consistent with the per-entry resolution above always re-deriving from
 * current state rather than blindly replaying history.
 *
 * All resolved upserts are sent to SearchIndex.upsert in one call, and
 * all resolved deletes in one call to SearchIndex.delete — not one call
 * per outbox row — then `markProcessed` is called for the whole batch
 * only once BOTH of those succeed. If either throws, this method rejects
 * without marking anything processed: the claimed rows' lease
 * (ports/outbox-repository.ts) simply expires and a later run retries
 * them from scratch. This is safe because every op here (Meilisearch
 * upsert/delete keyed on id) is idempotent — see that port's header
 * comment.
 */

import type { AgencyRepository } from '@/ports/agency-repository'
import type { ImageStorage } from '@/ports/image-storage'
import type { Listing, ListingReader } from '@/ports/listing-repository'
import type { OutboxEntry, OutboxRepository } from '@/ports/outbox-repository'
import type { PropertyImageReader } from '@/ports/property-image-repository'
import type { ListingSearchDocument, SearchIndex } from '@/ports/search-index'
import {
  mapListingToSearchDocument,
  NotIndexableListingError,
} from '@/services/search'

/** Vercel Cron drains every minute (PRD §8.6); 200 keeps one invocation
 * comfortably inside the "publish-to-searchable under 1 minute" exit
 * criterion even on a burst of activity, without needing to page through
 * the outbox within a single run. */
const DEFAULT_BATCH_SIZE = 200

export interface DrainOutboxResult {
  /** Outbox rows claimed and marked processed this run — a row count,
   * not a distinct-property count (see `upserts`/`deletes` for that). */
  processed: number
  /** Distinct properties upserted (after last-entry-wins resolution). */
  upserts: number
  /** Distinct properties deleted (after last-entry-wins resolution). */
  deletes: number
  /** OutboxRepository.countPending() after this run's markProcessed —
   * how far behind the drain worker still is. */
  pendingRemaining: number
}

type ResolvedAction =
  { kind: 'upsert'; doc: ListingSearchDocument } | { kind: 'delete' }

export class DrainOutbox {
  constructor(
    private readonly outboxRepository: OutboxRepository,
    private readonly listingReader: ListingReader,
    private readonly propertyImageReader: PropertyImageReader,
    private readonly agencyRepository: AgencyRepository,
    private readonly imageStorage: ImageStorage,
    private readonly searchIndex: SearchIndex,
    private readonly batchSize: number = DEFAULT_BATCH_SIZE,
  ) {}

  async execute(): Promise<DrainOutboxResult> {
    const batch = await this.outboxRepository.claimBatch(this.batchSize)
    if (batch.length === 0) {
      return {
        processed: 0,
        upserts: 0,
        deletes: 0,
        pendingRemaining: await this.outboxRepository.countPending(),
      }
    }

    const upsertDocsByPropertyId = new Map<string, ListingSearchDocument>()
    const deleteIds = new Set<string>()
    const resolveMemo = new Map<string, Promise<ResolvedAction>>()

    for (const entry of batch) {
      const action =
        entry.op === 'delete'
          ? ({ kind: 'delete' } as const)
          : await this.resolveUpsertEntry(entry, resolveMemo)

      if (action.kind === 'upsert') {
        deleteIds.delete(entry.propertyId)
        upsertDocsByPropertyId.set(entry.propertyId, action.doc)
      } else {
        upsertDocsByPropertyId.delete(entry.propertyId)
        deleteIds.add(entry.propertyId)
      }
    }

    if (upsertDocsByPropertyId.size > 0) {
      await this.searchIndex.upsert([...upsertDocsByPropertyId.values()])
    }
    if (deleteIds.size > 0) {
      await this.searchIndex.delete([...deleteIds])
    }

    await this.outboxRepository.markProcessed(batch.map((entry) => entry.id))

    return {
      processed: batch.length,
      upserts: upsertDocsByPropertyId.size,
      deletes: deleteIds.size,
      pendingRemaining: await this.outboxRepository.countPending(),
    }
  }

  /** Memoized per propertyId within one execute() call — a batch can
   * legitimately contain more than one upsert-op row for the same
   * property (e.g. two quick edits while published), and there is no
   * reason to load the same listing/images/agency twice. */
  private resolveUpsertEntry(
    entry: OutboxEntry,
    memo: Map<string, Promise<ResolvedAction>>,
  ): Promise<ResolvedAction> {
    const cached = memo.get(entry.propertyId)
    if (cached) return cached

    const resolved = this.buildAction(entry.propertyId)
    memo.set(entry.propertyId, resolved)
    return resolved
  }

  private async buildAction(propertyId: string): Promise<ResolvedAction> {
    const listing = await this.listingReader.findById(propertyId)
    if (!listing) return { kind: 'delete' }

    try {
      const doc = await this.mapToDocument(listing)
      return { kind: 'upsert', doc }
    } catch (error) {
      if (error instanceof NotIndexableListingError) return { kind: 'delete' }
      throw error
    }
  }

  private async mapToDocument(
    listing: Listing,
  ): Promise<ListingSearchDocument> {
    const [images, agency] = await Promise.all([
      this.propertyImageReader.listByProperty(listing.id),
      listing.agencyId
        ? this.agencyRepository.findById(listing.agencyId)
        : Promise.resolve(null),
    ])
    return mapListingToSearchDocument(
      listing,
      images,
      agency,
      this.imageStorage,
    )
  }
}
