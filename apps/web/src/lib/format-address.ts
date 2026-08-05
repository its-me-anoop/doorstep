/**
 * Address display formatting for the create-listing wizard's step 2
 * (M1-DESIGN-SPEC.md §3.2, field 3 — "display address" choice). Pure and
 * framework-free so it's trivially unit-testable and reusable from both
 * the address step's live preview and a future edit re-derivation.
 */

// A UK house number/range at the start of an address line: "12", "12a",
// "12-14" — optionally followed by a comma. Anything that doesn't start
// this way (a named property, "Flat 2, ...") is left alone: there's no
// reliable way to strip a name, and guessing wrong would show the wrong
// "street name and area only" preview on a legally-facing listing.
const LEADING_HOUSE_NUMBER = /^\d+[a-z]?(?:-\d+[a-z]?)?,?\s+/i

/** "12 Oxford Road" -> "Oxford Road". Falls back to the input unchanged
 * when it doesn't start with a recognisable house number. */
export function extractStreetName(addressLine1: string): string {
  return addressLine1.replace(LEADING_HOUSE_NUMBER, '')
}

export type DisplayAddressChoice = 'street' | 'full'

export interface DisplayAddressParts {
  addressLine1: string
  town: string
  outcode: string
  postcode: string
}

/**
 * The two "display address" previews (M1-DESIGN-SPEC.md §3.2's worked
 * example: "Shown as: Oxford Road, Reading, RG30."). Empty parts are
 * dropped rather than left as stray ", " — town/outcode are often still
 * blank before a successful postcode lookup.
 */
export function computeDisplayAddress(
  choice: DisplayAddressChoice,
  parts: DisplayAddressParts,
): string {
  if (!parts.addressLine1.trim()) return ''

  const line =
    choice === 'street'
      ? extractStreetName(parts.addressLine1)
      : parts.addressLine1
  const locality = choice === 'street' ? parts.outcode : parts.postcode

  return [line, parts.town, locality].filter((part) => part.trim()).join(', ')
}
