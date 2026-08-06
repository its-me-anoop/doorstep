/**
 * mapListingToSearchDocument — builds the exact PRD §8.6 document shape
 * (ports/search-index.ts's ListingSearchDocument) from a Listing, its
 * images and its agency. Pure re-derivation, not a stored projection —
 * the same "recompute from source rows every time, never persist the
 * derived shape" choice services/images/attach-image-urls.ts makes for
 * variant URLs, for the same reason: Postgres stays the source of truth
 * (PRD §8.6's opening line), so a document is only ever a disposable
 * view over it.
 *
 * Takes `imageStorage` as a fourth argument (this port, not a framework
 * type — DIP still holds) rather than staying a 3-argument pure
 * function, because resolving `coverImageUrl`/`agency.logoUrl` needs
 * ImageStorage.publicUrl(), which that port's own doc comment explains
 * cannot be derived from a path alone (Firebase's download-token scheme
 * needs a network round trip). This differs from
 * services/images/get-cover-blurhashes.ts's deliberate choice to avoid
 * exactly that network call — but that file's concern is a *list page's
 * render path* doing one call per row with no caching layer; this mapper
 * runs once per listing inside the (later) outbox drain worker's
 * batch job, only for listings that just changed, not on every request
 * for a full page of rows. Called with an in-memory/data-URL fake in
 * every test here — see tests/support/in-memory-image-storage.ts.
 *
 * Only `published`/`under_offer` listings are indexable (PRD §8.6) —
 * enforced as a guard that throws NotIndexableListingError rather than
 * silently mapping every status, since a caller passing anything else
 * is a bug (the outbox only ever enqueues an `upsert` op while a listing
 * is in one of these two statuses) worth surfacing loudly, not a normal
 * "no document" case to swallow.
 */

import type { PropertyStatus } from '@/domain/enums'
import { variantImagePath } from '@/domain/image-storage-path'
import type { Agency } from '@/ports/agency-repository'
import type { ImageStorage } from '@/ports/image-storage'
import type { Listing } from '@/ports/listing-repository'
import type { PropertyImage } from '@/ports/property-image-repository'
import type {
  ListingSearchAgency,
  ListingSearchDocument,
} from '@/ports/search-index'

import { NotIndexableListingError } from './errors'

const COVER_VARIANT_WIDTH = 800
const COVER_VARIANT_FORMAT = 'webp'

const INDEXABLE_STATUSES: ReadonlySet<PropertyStatus> = new Set([
  'published',
  'under_offer',
])

/** `YYYY-MM-DD` — same convention lib/listing-wizard-form.ts's
 * dateToInputValue uses for the wizard's date input, kept as a tiny local
 * helper here rather than imported from that (UI-form-specific) module. */
function toDateOnlyString(date: Date): string {
  return date.toISOString().slice(0, 10)
}

function unixSeconds(date: Date): number {
  return Math.floor(date.getTime() / 1000)
}

/** The photo (never floorplan/EPC, even if one happens to occupy
 * position 0 after a SetImageKind retag — see
 * ports/property-image-repository.ts's countByPropertyAndKind doc
 * comment on those being single-purpose slots, not part of the photo
 * grid) with the lowest `position`, or null when the listing has none
 * yet. */
function findCoverPhoto(
  images: readonly PropertyImage[],
): PropertyImage | null {
  return images
    .filter((image) => image.kind === 'photo')
    .reduce<PropertyImage | null>(
      (lowest, image) =>
        lowest === null || image.position < lowest.position ? image : lowest,
      null,
    )
}

async function mapAgency(
  agency: Agency | null,
  imageStorage: ImageStorage,
): Promise<ListingSearchAgency | null> {
  if (!agency) return null

  return {
    id: agency.id,
    name: agency.name,
    logoUrl: agency.logoPath
      ? await imageStorage.publicUrl(agency.logoPath)
      : null,
  }
}

export async function mapListingToSearchDocument(
  listing: Listing,
  images: readonly PropertyImage[],
  agency: Agency | null,
  imageStorage: ImageStorage,
): Promise<ListingSearchDocument> {
  if (!INDEXABLE_STATUSES.has(listing.status)) {
    throw new NotIndexableListingError(listing.id, listing.status)
  }
  if (!listing.publishedAt) {
    // Should never happen: the status machine only reaches 'published'/
    // 'under_offer' through a transition that stamps publishedAt (PRD
    // §9.2, ports/listing-repository.ts's ListingTransitionOptions doc
    // comment) — a corrupted-data invariant, not a normal case a typed
    // error's caller would branch on.
    throw new Error(
      `Listing ${listing.id} is "${listing.status}" but has no publishedAt`,
    )
  }

  const photos = images.filter((image) => image.kind === 'photo')
  const coverPhoto = findCoverPhoto(images)
  const coverImageUrl = coverPhoto
    ? await imageStorage.publicUrl(
        variantImagePath(
          listing.id,
          coverPhoto.id,
          COVER_VARIANT_WIDTH,
          COVER_VARIANT_FORMAT,
        ),
      )
    : null

  return {
    id: listing.id,
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
    furnished: listing.furnished,
    availableFrom: listing.availableFrom
      ? toDateOnlyString(listing.availableFrom)
      : null,
    newHome: listing.newHome,
    features: listing.features,
    coverImageUrl,
    imageCount: photos.length,
    agency: await mapAgency(agency, imageStorage),
    publishedAt: unixSeconds(listing.publishedAt),
    _geo: listing.location,
  }
}
