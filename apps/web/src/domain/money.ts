/**
 * Money convention (PRD §9): every amount is stored as an integer — whole
 * pounds for a sale price, whole pounds-per-calendar-month for a rent.
 * Never a float, never pence. Callers that need pence-level precision
 * (there are none in MVP) would need a new column, not a change to this
 * convention.
 */

import type { Channel, PriceQualifier } from './enums'

const QUALIFIER_PREFIX: Record<Exclude<PriceQualifier, 'poa'>, string> = {
  fixed: '',
  guide_price: 'Guide price ',
  offers_over: 'Offers over ',
  offers_in_region: 'Offers in region of ',
}

export interface FormatPriceInput {
  channel: Channel
  price: number
  priceQualifier: PriceQualifier
}

export function formatPrice({
  channel,
  price,
  priceQualifier,
}: FormatPriceInput): string {
  if (priceQualifier === 'poa') return 'POA'

  const amount = `£${price.toLocaleString('en-GB')}`
  const suffix = channel === 'rent' ? ' pcm' : ''
  return `${QUALIFIER_PREFIX[priceQualifier]}${amount}${suffix}`
}

/**
 * The map pin's compact price label (M3-DESIGN-SPEC.md §1.2) — a
 * different formatter from `formatPrice`, not a variant of it: the pin
 * has ~60px of chip to work with, so it needs an abbreviated form
 * (`£350k`, `£1.3m`) rather than full running text
 * (`Guide price £350,000`). Deliberately takes no `priceQualifier`,
 * matching the spec's own signature exactly — a `poa` listing's pin
 * content is the caller's concern (M3's `geojson.ts` mapper), not this
 * function's, since "POA" isn't a price to abbreviate at all.
 */
export function formatPinPrice(channel: Channel, price: number): string {
  if (channel === 'rent') {
    return `£${price.toLocaleString('en-GB')} pcm`
  }

  if (price < 1_000_000) {
    return `£${Math.round(price / 1000)}k`
  }

  const millions = (price / 1_000_000).toFixed(1).replace(/\.0$/, '')
  return `£${millions}m`
}
