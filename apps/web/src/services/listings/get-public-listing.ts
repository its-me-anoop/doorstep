/**
 * GetPublicListing — the use case behind GET /api/v1/properties/{slug}
 * (PRD §10) and the `/property/{slug}` detail page (M2-DESIGN-SPEC.md
 * §5). Public — no session, mirroring services/search/search-listings.ts's
 * shape (browsing a published listing is a guest capability, PRD §8.4).
 *
 * Visible only for `published`/`under_offer` — the same pair
 * services/search/map-listing-to-search-document.ts's INDEXABLE_STATUSES
 * names (PRD §8.6) — anything else (draft, pending_review, rejected,
 * completed, hidden, archived) throws the exact same
 * PublicListingNotFoundError an unknown slug does, never a distinct
 * "exists but not visible" signal: a lister's own hidden/pending listing
 * should be indistinguishable from a typo'd URL to an unauthenticated
 * visitor (the object-level manager view, GET /api/v1/listings/{id}, is
 * the separate, authenticated route for that).
 *
 * `addressLine1` and `postcode` (the two fields PRD §9.2/DET-3 forbid
 * showing publicly) are never read onto `PublicListingDetail` — see that
 * type's own doc comment.
 */

import { getDisplayStatus } from '@/domain/display-status'
import type {
  Channel,
  CouncilTaxBand,
  EpcRating,
  Furnished,
  ImageKind,
  PriceQualifier,
  PropertyStatus,
  PropertyType,
  Tenure,
} from '@/domain/enums'
import type { GeoPoint } from '@/domain/property'
import type { AgencyRepository } from '@/ports/agency-repository'
import type { ImageStorage } from '@/ports/image-storage'
import type { ListingReader } from '@/ports/listing-repository'
import type { PropertyImageReader } from '@/ports/property-image-repository'
import { attachImageUrls, type ImageVariantUrl } from '@/services/images'

import { PublicListingNotFoundError } from './errors'

const PUBLIC_STATUSES: ReadonlySet<PropertyStatus> = new Set([
  'published',
  'under_offer',
])

export interface PublicListingImage {
  id: string
  kind: ImageKind
  position: number
  width: number
  height: number
  blurhash: string
  altText: string | null
  urls: ImageVariantUrl[]
}

export interface PublicListingAgency {
  id: string
  name: string
  logoUrl: string | null
}

/**
 * The public listing detail DTO (M2-DESIGN-SPEC.md §5). Deliberately has
 * no `addressLine1`/`postcode`/`listerId`/`agencyId`(raw)/`status`(raw)/
 * `rejectionReason` field — this is the type-level half of DET-3's
 * privacy rule, alongside the runtime check in `GetPublicListing.execute`:
 * a caller can't accidentally serialise a field this type never carries.
 */
export interface PublicListingDetail {
  id: string
  slug: string
  channel: Channel
  title: string
  displayAddress: string
  town: string
  outcode: string
  propertyType: PropertyType
  bedrooms: number
  bathrooms: number
  price: number
  priceQualifier: PriceQualifier
  tenure: Tenure | null
  deposit: number | null
  furnished: Furnished | null
  /** `YYYY-MM-DD`, or null. */
  availableFrom: string | null
  epcRating: EpcRating | null
  councilTaxBand: CouncilTaxBand | null
  newHome: boolean
  description: string
  features: string[]
  /** `getDisplayStatus(status, channel)` — `'published'` literally, or
   * the friendly "Sold STC"/"Let Agreed" label (§5.2's status banner). */
  displayStatus: string
  images: PublicListingImage[]
  geo: GeoPoint
  /** Reserved for M3's map pin-vs-circle rendering (§5.6) — no M2 UI
   * branches on this yet. */
  locationApproximate: boolean
  agency: PublicListingAgency | null
  /** Unix seconds, matching `PublicSearchHit.publishedAt`'s convention. */
  publishedAt: number
}

function toDateOnlyString(date: Date): string {
  return date.toISOString().slice(0, 10)
}

export class GetPublicListing {
  constructor(
    private readonly listingReader: ListingReader,
    private readonly propertyImageReader: PropertyImageReader,
    private readonly agencyRepository: AgencyRepository,
    private readonly imageStorage: ImageStorage,
  ) {}

  async execute(slug: string): Promise<PublicListingDetail> {
    const listing = await this.listingReader.findBySlug(slug)
    if (!listing || !PUBLIC_STATUSES.has(listing.status)) {
      throw new PublicListingNotFoundError(slug)
    }
    if (!listing.publishedAt) {
      // Same invariant map-listing-to-search-document.ts guards: every
      // route that reaches published/under_offer stamped publishedAt on
      // first publish (PRD §9.2). Not a normal caller-facing case.
      throw new Error(
        `Listing ${listing.id} is "${listing.status}" but has no publishedAt`,
      )
    }

    const [images, agency] = await Promise.all([
      this.propertyImageReader.listByProperty(listing.id),
      listing.agencyId
        ? this.agencyRepository.findById(listing.agencyId)
        : Promise.resolve(null),
    ])

    const sortedImages = [...images].sort((a, b) => a.position - b.position)
    const publicImages = await Promise.all(
      sortedImages.map(async (image) => {
        const withUrls = await attachImageUrls(image, this.imageStorage)
        return {
          id: withUrls.id,
          kind: withUrls.kind,
          position: withUrls.position,
          width: withUrls.width,
          height: withUrls.height,
          blurhash: withUrls.blurhash,
          altText: withUrls.altText,
          urls: withUrls.urls,
        }
      }),
    )

    const publicAgency: PublicListingAgency | null = agency
      ? {
          id: agency.id,
          name: agency.name,
          logoUrl: agency.logoPath
            ? await this.imageStorage.publicUrl(agency.logoPath)
            : null,
        }
      : null

    return {
      id: listing.id,
      slug: listing.slug,
      channel: listing.channel,
      title: listing.title,
      displayAddress: listing.displayAddress,
      town: listing.town,
      outcode: listing.outcode,
      propertyType: listing.propertyType,
      bedrooms: listing.bedrooms,
      bathrooms: listing.bathrooms,
      price: listing.price,
      priceQualifier: listing.priceQualifier,
      tenure: listing.tenure,
      deposit: listing.deposit,
      furnished: listing.furnished,
      availableFrom: listing.availableFrom
        ? toDateOnlyString(listing.availableFrom)
        : null,
      epcRating: listing.epcRating,
      councilTaxBand: listing.councilTaxBand,
      newHome: listing.newHome,
      description: listing.description,
      features: listing.features,
      displayStatus: getDisplayStatus(listing.status, listing.channel),
      images: publicImages,
      geo: listing.location,
      locationApproximate: listing.locationApproximate,
      agency: publicAgency,
      publishedAt: Math.floor(listing.publishedAt.getTime() / 1000),
    }
  }
}
