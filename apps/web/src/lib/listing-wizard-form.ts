/**
 * The create-listing wizard's one RHF form shape (M1-DESIGN-SPEC.md §3),
 * and the two pure mappers between it and the server's `Listing`/
 * `DraftListingInput` shapes. Kept separate from those two so each side
 * can evolve for its own reason: `Listing` is the stored row,
 * `DraftListingInput` is the wire shape, `ListingFormValues` is what a
 * bank of native `<select>`s and controlled inputs can actually hold —
 * '' as the universal "nothing chosen yet" sentinel (native selects
 * can't bind to `undefined`), plus one wizard-local field
 * (`displayAddressChoice`) that is never itself sent to the server.
 *
 * `newHome` has no field in this shape at all — M1-DESIGN-SPEC.md's
 * wizard section never surfaces a "new build" control, so the server's
 * default (`false`, services/listings/create-listing-draft.ts) simply
 * stands untouched for every M1 listing; picking it up is a scope
 * addition beyond the spec, not an oversight.
 */

import type {
  Channel,
  CouncilTaxBand,
  EpcRating,
  Furnished,
  PriceQualifier,
  PropertyType,
  Tenure,
} from '@/domain/enums'
import type { Listing } from '@/ports/listing-repository'
import type { DisplayAddressChoice } from './format-address'
import type { DraftListingInput } from './validation/listing'

export interface ListingFormValues {
  channel: Channel | ''
  propertyType: PropertyType | ''
  addressLine1: string
  /** Wizard-local only — drives which of the two `displayAddress`
   * previews (§3.2 field 3) is computed; never sent to the server. */
  displayAddressChoice: DisplayAddressChoice
  displayAddress: string
  town: string
  outcode: string
  postcode: string
  /** `null` until a postcode lookup succeeds — never the
   * `CreateListingDraft` {lat:0,lng:0} placeholder, see
   * listingToFormValues's doc comment below. */
  location: { lat: number; lng: number } | null
  locationApproximate: boolean
  bedrooms: number | ''
  bathrooms: number | ''
  price: number | ''
  priceQualifier: PriceQualifier | ''
  tenure: Tenure | ''
  deposit: number | ''
  furnished: Furnished | ''
  /** A native `<input type="date">` value: 'yyyy-mm-dd' or ''. */
  availableFrom: string
  epcRating: EpcRating | ''
  councilTaxBand: CouncilTaxBand | ''
  description: string
  features: string[]
}

/** services/listings/create-listing-draft.ts's own "unset" placeholder
 * for a draft that has never had a real postcode lookup — {lat:0,lng:0}
 * is a real WGS84 point (off the coast of west Africa), not a listing
 * anyone will ever actually have, so it's safe to treat as "no location
 * yet" on the way back into the form. */
function hasRealLocation(location: { lat: number; lng: number }): boolean {
  return location.lat !== 0 || location.lng !== 0
}

function dateToInputValue(date: Date | null): string {
  return date ? date.toISOString().slice(0, 10) : ''
}

/** Server `Listing` -> wizard form state. Every optional/nullable server
 * field becomes '' when absent — the select-friendly sentinel — except
 * `bedrooms`, where 0 is a real, meaningful value ("Studio") rather than
 * "unanswered", so it's never blanked. */
export function listingToFormValues(listing: Listing): ListingFormValues {
  return {
    channel: listing.channel,
    propertyType: listing.propertyType,
    addressLine1: listing.addressLine1,
    displayAddressChoice: 'street',
    displayAddress: listing.displayAddress,
    town: listing.town,
    outcode: listing.outcode,
    postcode: listing.postcode,
    location: hasRealLocation(listing.location) ? listing.location : null,
    locationApproximate: listing.locationApproximate,
    bedrooms: listing.bedrooms,
    bathrooms: listing.bathrooms === 0 ? '' : listing.bathrooms,
    price: listing.price === 0 ? '' : listing.price,
    priceQualifier: listing.priceQualifier,
    tenure: listing.tenure ?? '',
    deposit: listing.deposit ?? '',
    furnished: listing.furnished ?? '',
    availableFrom: dateToInputValue(listing.availableFrom),
    epcRating: listing.epcRating ?? '',
    councilTaxBand: listing.councilTaxBand ?? '',
    description: listing.description,
    features: listing.features,
  }
}

/** Wizard form state -> the PATCH/POST wire payload. `channel` and
 * `propertyType` are always included (draftListingSchema requires both
 * on every request — UpdateListing rejects a `channel` that doesn't
 * match the stored value, so this must always echo the current one, not
 * omit it). Every other field collapses its '' sentinel to `undefined`
 * so the loose draft schema's `.optional()` fields are genuinely absent
 * rather than sent as an empty string. `availableFrom` stays a plain
 * 'yyyy-mm-dd' string — the wire format is JSON either way, and the
 * server's `z.coerce.date()` parses that string identically to a `Date`. */
export function formValuesToDraftInput(
  values: ListingFormValues,
): Partial<DraftListingInput> {
  const orUndefined = <T>(value: T | ''): T | undefined =>
    value === '' ? undefined : value

  return {
    channel: values.channel as Channel,
    propertyType: values.propertyType as PropertyType,
    description: orUndefined(values.description),
    features: values.features,
    bedrooms: orUndefined(values.bedrooms),
    bathrooms: orUndefined(values.bathrooms),
    price: orUndefined(values.price),
    priceQualifier: orUndefined(values.priceQualifier),
    tenure: orUndefined(values.tenure),
    deposit: orUndefined(values.deposit),
    furnished: orUndefined(values.furnished),
    availableFrom: orUndefined(
      values.availableFrom,
    ) as unknown as DraftListingInput['availableFrom'],
    epcRating: orUndefined(values.epcRating),
    councilTaxBand: orUndefined(values.councilTaxBand),
    addressLine1: orUndefined(values.addressLine1),
    displayAddress: orUndefined(values.displayAddress),
    town: orUndefined(values.town),
    outcode: orUndefined(values.outcode),
    postcode: orUndefined(values.postcode),
    location: values.location ?? undefined,
    locationApproximate: values.locationApproximate,
  }
}
