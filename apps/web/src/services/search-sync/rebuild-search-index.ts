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

/** One page's worth of listings mapped and upserted per SearchIndex.upsert
 * call, keeping any single call's payload bounded regardless of how many
 * listings exist in total. */
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
    await this.searchIndex.clear()

    const indexed = await this.indexEveryPage()

    const meiliCountAfter = await this.searchIndex.countDocuments()
    if (meiliCountAfter !== postgresCount) {
      console.warn(
        `RebuildSearchIndex: count mismatch — Postgres reports ` +
          `${postgresCount} indexable listing(s) but Meilisearch reports ` +
          `${meiliCountAfter} document(s) after this reindex.`,
      )
    }

    return {
      indexed,
      drift: { postgresCount, meiliCountBefore, meiliCountAfter },
    }
  }

  private async indexEveryPage(): Promise<number> {
    let indexed = 0
    let cursor: string | null = null

    do {
      const page = await this.listingReader.listIndexable({
        cursor,
        limit: this.pageSize,
      })
      if (page.data.length > 0) {
        const docs = await Promise.all(
          page.data.map((listing) => this.mapToDocument(listing)),
        )
        await this.searchIndex.upsert(docs)
        indexed += docs.length
      }
      cursor = page.nextCursor
    } while (cursor)

    return indexed
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
