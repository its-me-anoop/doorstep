/**
 * Plain-English labels for the wizard's enum fields (M1-DESIGN-SPEC.md
 * §3.1, §3.3). Copy lives here, once, shared by whichever step renders
 * the `<select>` for a field and by the review step's read-only summary
 * (§3.6: "what you see on Review is what you typed, labelled the same
 * way") — the enum *values* themselves come from
 * lib/validation/listing.ts, this file only ever adds the human label.
 */
import {
  EPC_RATING,
  FURNISHED,
  PRICE_QUALIFIER,
  PROPERTY_TYPE,
  TENURE,
} from '@/lib/validation/listing'

export const PROPERTY_TYPE_LABELS: Record<
  (typeof PROPERTY_TYPE.options)[number],
  string
> = {
  detached: 'Detached house',
  semi_detached: 'Semi-detached house',
  terraced: 'Terraced house',
  flat: 'Flat or apartment',
  bungalow: 'Bungalow',
  maisonette: 'Maisonette',
  land: 'Land',
  other: 'Other',
}

export const PRICE_QUALIFIER_LABELS: Record<
  (typeof PRICE_QUALIFIER.options)[number],
  string
> = {
  fixed: 'Fixed price',
  guide_price: 'Guide price',
  offers_over: 'Offers over',
  offers_in_region: 'Offers in region of',
  poa: 'POA',
}

export const TENURE_LABELS: Record<(typeof TENURE.options)[number], string> = {
  freehold: 'Freehold',
  leasehold: 'Leasehold',
  share_of_freehold: 'Share of freehold',
  unknown: 'Not sure',
}

export const FURNISHED_LABELS: Record<
  (typeof FURNISHED.options)[number],
  string
> = {
  furnished: 'Furnished',
  part_furnished: 'Part-furnished',
  unfurnished: 'Unfurnished',
}

/** A/B/C.../G already read fine as-is — kept here anyway so every
 * enum-to-label lookup on Review goes through one convention rather than
 * some fields using a map and others rendering their raw value. */
export const EPC_RATING_LABELS: Record<
  (typeof EPC_RATING.options)[number],
  string
> = Object.fromEntries(
  EPC_RATING.options.map((option) => [option, option]),
) as Record<(typeof EPC_RATING.options)[number], string>

/** step-details.tsx's own bedroom `<select>` option set — also the
 * buyer-side Beds filter's vocabulary verbatim
 * (M2-DESIGN-SPEC.md §1.3: "a buyer's mental model of 'studio through
 * 6+' is the same list a lister just picked from — one vocabulary, not
 * two"). Lives here, not in step-details.tsx, now that a second
 * (search-side) consumer exists — the same "shared copy, not duplicated
 * per caller" rule every other export in this file already follows. */
export const BEDROOM_OPTIONS = [
  { value: 0, label: 'Studio' },
  { value: 1, label: '1' },
  { value: 2, label: '2' },
  { value: 3, label: '3' },
  { value: 4, label: '4' },
  { value: 5, label: '5' },
  { value: 6, label: '6+' },
] as const
