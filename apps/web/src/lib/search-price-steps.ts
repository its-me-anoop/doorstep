/**
 * Stepped price vocabularies for the buyer-side Price filter
 * (M2-DESIGN-SPEC.md §1.2). Native `<select>` continuity with the
 * wizard's own stepped fields — one option list per channel, Min and Max
 * sharing it (Max simply omits values at-or-below the current Min,
 * filtered client-side via `maxPriceOptionsFor`, never a separate
 * hardcoded "max list").
 *
 * Values are whole pounds for sale, whole pounds pcm for rent
 * (domain/money.ts's convention) — never floats, never pence.
 */

import type { Channel } from '@/domain/enums'

export const SALE_PRICE_STEPS: readonly number[] = [
  50000, 75000, 100000, 125000, 150000, 175000, 200000, 225000, 250000, 275000,
  300000, 325000, 350000, 375000, 400000, 425000, 450000, 475000, 500000,
  550000, 600000, 650000, 700000, 750000, 800000, 900000, 1000000, 1250000,
  1500000, 2000000,
]

export const RENT_PRICE_STEPS: readonly number[] = [
  500, 600, 700, 800, 900, 1000, 1100, 1200, 1300, 1400, 1500, 1600, 1750, 2000,
  2250, 2500, 3000, 3500, 4000, 5000,
]

/** §1.2's reset rule lives one layer up (the channel toggle, not here) —
 * this is purely "which list does this channel look up," the same
 * mechanical lookup a `Record<Channel, ...>` would give, spelled as a
 * function so callers don't reach into a map key that might not exist. */
export function priceStepsForChannel(channel: Channel): readonly number[] {
  return channel === 'sale' ? SALE_PRICE_STEPS : RENT_PRICE_STEPS
}

/** The Max select's own option list: every step strictly greater than the
 * current Min (or every step, when Min is unset/"No min") — "Max simply
 * omits values below whatever Min is currently set to, filtered
 * client-side" (§1.2). */
export function maxPriceOptionsFor(
  steps: readonly number[],
  min: number | undefined,
): readonly number[] {
  if (min === undefined) return steps
  return steps.filter((step) => step > min)
}
