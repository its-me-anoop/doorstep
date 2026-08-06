/**
 * ListNewestInArea — the use case behind an area landing page's "Newest
 * in {area}" strip (M2-DESIGN-SPEC.md §4.1 point 3). Public — no
 * actor/authz, same shape as SearchListings, since a published listing
 * is guest-visible content (PRD §8.4).
 *
 * Deliberately reads through `ListingReader.listNewestPublished`
 * (Postgres) rather than `SearchIndex.search` (Meilisearch): this is the
 * one section of an area landing page that keeps working during a
 * search-index outage (§1.10 point 4) — the whole reason it's specced as
 * a separate data path from the rest of the results grid.
 *
 * Maps each `Listing` to the exact same `PublicSearchHit` DTO the search
 * results grid uses, by composing the two mappers that already exist for
 * the Postgres -> Meilisearch projection (`mapListingToSearchDocument`)
 * and the Meilisearch document -> public API DTO
 * (`toPublicHit`) — this reuses both verbatim instead of writing a third,
 * parallel "Listing -> card DTO" mapping. The result is renderable
 * directly by `ResultCard` (§1.8), the same component the results grid
 * uses, per the spec's "the same result-card component ... at the same
 * size" instruction.
 */

import type { Channel } from '@/domain/enums'
import type { AgencyRepository } from '@/ports/agency-repository'
import type { ImageStorage } from '@/ports/image-storage'
import type {
  AreaListingCriteria,
  ListingReader,
} from '@/ports/listing-repository'
import type { PropertyImageReader } from '@/ports/property-image-repository'
import {
  mapListingToSearchDocument,
  toPublicHit,
  type PublicSearchHit,
} from '@/services/search'

/** §4.1: "the 4 most recent published listings in this area." */
const NEWEST_STRIP_LIMIT = 4

export class ListNewestInArea {
  constructor(
    private readonly listingReader: ListingReader,
    private readonly propertyImageReader: PropertyImageReader,
    private readonly agencyRepository: AgencyRepository,
    private readonly imageStorage: ImageStorage,
  ) {}

  async execute(
    channel: Channel,
    match: Pick<AreaListingCriteria, 'town' | 'outcode'>,
  ): Promise<PublicSearchHit[]> {
    const listings = await this.listingReader.listNewestPublished(
      { channel, ...match },
      NEWEST_STRIP_LIMIT,
    )

    return Promise.all(
      listings.map(async (listing) => {
        const images = await this.propertyImageReader.listByProperty(listing.id)
        const agency = listing.agencyId
          ? await this.agencyRepository.findById(listing.agencyId)
          : null
        const document = await mapListingToSearchDocument(
          listing,
          images,
          agency,
          this.imageStorage,
        )
        return toPublicHit(document)
      }),
    )
  }
}
