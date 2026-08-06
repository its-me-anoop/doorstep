/**
 * RebuildSearchIndex — the use case behind the (later) POST/GET
 * /api/cron/reindex route: PRD §8.6's "a nightly full reindex reconciles
 * drift, and a count-mismatch alert catches sync bugs."
 *
 * Baseline strategy: clear-then-reindex, not diff-and-patch. The
 * alternative — compute exactly which documents are orphaned in
 * Meilisearch and delete only those — needs a way to enumerate every id
 * currently in the index, which ports/search-index.ts's SearchIndex has
 * no method for (search() is query-scoped, not "list everything"), and
 * inventing one just for a once-a-night job is speculative surface this
 * change doesn't otherwise need. `clear()` + a full re-upsert is simpler,
 * gives an unambiguous end state (exactly what's in Postgres right now,
 * nothing else), and PRD §8.6 itself calls Meilisearch "a disposable
 * projection" — the brief window where the index is emptier than it
 * should be (scheduled for 03:00, PRD §13's M2 row) is an accepted
 * trade-off for that simplicity, not an oversight.
 *
 * Sequencing: the FULL set of documents is built (and any per-listing
 * mapping failure skipped, see below) before `clear()` is ever called —
 * `clear()` only runs once `buildAllDocuments()` has returned
 * successfully. This is deliberately more than "build-then-write": it
 * means a failure that prevents building the document set at all (a
 * Postgres read failing partway through pagination, say) leaves the
 * previous good index completely untouched, rather than clearing it and
 * then having nothing to re-upsert. The `SearchIndex` port has no
 * "upsert into a temporary index and atomically swap" capability (that
 * would eliminate the brief empty-index window entirely, not just the
 * partial-failure case this addresses) — adding one is exactly the kind
 * of speculative surface the clear-then-reindex baseline decision above
 * already declined, so it's left as a documented option for later, not
 * built speculatively here.
 *
 * Per-listing resilience: `mapToDocument` is called per listing inside
 * `buildAllDocuments`, and any error it throws (a missing/expired
 * ImageStorage object, a corrupted publishedAt invariant, ...) is caught,
 * logged, and that ONE listing is skipped rather than propagated. This is
 * a deliberately BROADER catch than DrainOutbox's own resilient handling
 * (services/search-sync/drain-outbox.ts only converts a
 * NotIndexableListingError to a delete and re-throws everything else):
 * DrainOutbox acts on a single listing right after a mutation, so an
 * unexpected error there is rare and worth surfacing immediately: a
 * nightly full-catalogue rebuild is exactly the opposite case — one
 * listing with a stale image reference or a corrupted row must not be
 * allowed to empty the *entire* search index for every other, perfectly
 * healthy listing. A skipped listing isn't silently lost either: it makes
 * `meiliCountAfter` fall short of `postgresCount`, which the
 * count-mismatch `console.warn` below already exists to catch — PRD
 * §7.7's "alert catches sync bugs" doing exactly the job it was built
 * for.
 *
 * Drift reporting: `postgresCount` (ListingReader.countIndexable, the
 * source of truth) is compared against `meiliCountAfter` once the run
 * finishes; a mismatch is logged via console.warn (there is no
 * Sentry/alerting integration in this codebase yet to route it to
 * instead — PRD §8.6's "alert" is the north star this satisfies the
 * detectable-signal half of, not the notification-delivery half).
 * `meiliCountBefore` is captured for the same reason DrainOutbox's result
 * reports `pendingRemaining`: visibility into how far reality had already
 * drifted before this run corrected it.
 */

import type { AgencyRepository } from '@/ports/agency-repository'
import type { ImageStorage } from '@/ports/image-storage'
import type { Listing, ListingReader } from '@/ports/listing-repository'
import type { PropertyImageReader } from '@/ports/property-image-repository'
import type { ListingSearchDocument, SearchIndex } from '@/ports/search-index'
import { mapListingToSearchDocument } from '@/services/search'

/** Two independent uses: (1) how many listings `ListingReader.listIndexable`
 * fetches per page while building the full document set, and (2) how many
 * documents go into a single `SearchIndex.upsert` call once that set is
 * ready — keeping any one call's payload bounded regardless of how many
 * listings exist in total, even though the whole set is now assembled in
 * memory first (see this file's header comment on why). */
const DEFAULT_PAGE_SIZE = 200

export interface RebuildSearchIndexDrift {
  postgresCount: number
  meiliCountBefore: number
  meiliCountAfter: number
}

export interface RebuildSearchIndexResult {
  indexed: number
  drift: RebuildSearchIndexDrift
}

export class RebuildSearchIndex {
  constructor(
    private readonly listingReader: ListingReader,
    private readonly propertyImageReader: PropertyImageReader,
    private readonly agencyRepository: AgencyRepository,
    private readonly imageStorage: ImageStorage,
    private readonly searchIndex: SearchIndex,
    private readonly pageSize: number = DEFAULT_PAGE_SIZE,
  ) {}

  async execute(): Promise<RebuildSearchIndexResult> {
    const postgresCount = await this.listingReader.countIndexable()
    const meiliCountBefore = await this.searchIndex.countDocuments()

    await this.searchIndex.ensureSettings()

    // Built (and per-listing failures skipped) BEFORE clear() runs — see
    // this file's header comment on why the destructive step waits until
    // the replacement document set is ready rather than running first.
    const documents = await this.buildAllDocuments()

    await this.searchIndex.clear()
    await this.upsertInPages(documents)

    const meiliCountAfter = await this.searchIndex.countDocuments()
    if (meiliCountAfter !== postgresCount) {
      console.warn(
        `RebuildSearchIndex: count mismatch — Postgres reports ` +
          `${postgresCount} indexable listing(s) but Meilisearch reports ` +
          `${meiliCountAfter} document(s) after this reindex.`,
      )
    }

    return {
      indexed: documents.length,
      drift: { postgresCount, meiliCountBefore, meiliCountAfter },
    }
  }

  private async buildAllDocuments(): Promise<ListingSearchDocument[]> {
    const documents: ListingSearchDocument[] = []
    let cursor: string | null = null

    do {
      const page = await this.listingReader.listIndexable({
        cursor,
        limit: this.pageSize,
      })
      const outcomes = await Promise.allSettled(
        page.data.map((listing) => this.mapToDocument(listing)),
      )
      outcomes.forEach((outcome, index) => {
        if (outcome.status === 'fulfilled') {
          documents.push(outcome.value)
          return
        }
        const listing = page.data[index]
        const reason =
          outcome.reason instanceof Error
            ? outcome.reason.message
            : String(outcome.reason)
        console.error(
          `RebuildSearchIndex: skipping listing ${listing.id} — its ` +
            `search document could not be built: ${reason}`,
        )
      })
      cursor = page.nextCursor
    } while (cursor)

    return documents
  }

  private async upsertInPages(
    documents: ListingSearchDocument[],
  ): Promise<void> {
    for (let start = 0; start < documents.length; start += this.pageSize) {
      await this.searchIndex.upsert(
        documents.slice(start, start + this.pageSize),
      )
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
