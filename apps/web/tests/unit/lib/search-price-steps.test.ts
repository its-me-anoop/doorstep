import { describe, expect, it } from 'vitest'

import {
  RENT_PRICE_STEPS,
  SALE_PRICE_STEPS,
  maxPriceOptionsFor,
  priceStepsForChannel,
} from '@/lib/search-price-steps'

// M2-DESIGN-SPEC.md §1.2 — exact stepped price vocabularies. Values are
// asserted in full since a single dropped/mistyped step silently produces
// a filter Sarah or Tom can never select.
describe('SALE_PRICE_STEPS', () => {
  it('is exactly the spec-listed sale vocabulary, in ascending order', () => {
    expect(SALE_PRICE_STEPS).toEqual([
      50000, 75000, 100000, 125000, 150000, 175000, 200000, 225000, 250000,
      275000, 300000, 325000, 350000, 375000, 400000, 425000, 450000, 475000,
      500000, 550000, 600000, 650000, 700000, 750000, 800000, 900000, 1000000,
      1250000, 1500000, 2000000,
    ])
  })
})

describe('RENT_PRICE_STEPS', () => {
  it('is exactly the spec-listed rent vocabulary, in ascending order', () => {
    expect(RENT_PRICE_STEPS).toEqual([
      500, 600, 700, 800, 900, 1000, 1100, 1200, 1300, 1400, 1500, 1600, 1750,
      2000, 2250, 2500, 3000, 3500, 4000, 5000,
    ])
  })
})

describe('priceStepsForChannel', () => {
  it('returns the sale steps for channel "sale"', () => {
    expect(priceStepsForChannel('sale')).toBe(SALE_PRICE_STEPS)
  })

  it('returns the rent steps for channel "rent"', () => {
    expect(priceStepsForChannel('rent')).toBe(RENT_PRICE_STEPS)
  })
})

describe('maxPriceOptionsFor', () => {
  it('returns every step when no min is set', () => {
    expect(maxPriceOptionsFor(SALE_PRICE_STEPS, undefined)).toEqual(
      SALE_PRICE_STEPS,
    )
  })

  it('omits every step at or below the current min (Max never undercuts Min)', () => {
    expect(maxPriceOptionsFor(SALE_PRICE_STEPS, 300000)).toEqual([
      325000, 350000, 375000, 400000, 425000, 450000, 475000, 500000, 550000,
      600000, 650000, 700000, 750000, 800000, 900000, 1000000, 1250000, 1500000,
      2000000,
    ])
  })

  it('returns an empty list when min is the highest step', () => {
    expect(maxPriceOptionsFor(SALE_PRICE_STEPS, 2000000)).toEqual([])
  })
})
