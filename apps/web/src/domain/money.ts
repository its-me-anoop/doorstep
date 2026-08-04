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
