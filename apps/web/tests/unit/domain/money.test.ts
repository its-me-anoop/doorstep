import { describe, expect, it } from 'vitest'

import { formatPinPrice, formatPrice } from '@/domain/money'

// Money convention (documented in src/domain/money.ts): amounts are always
// stored as integer pounds — sale price and rent pcm alike. No floats,
// no pence. See PRD §9: "Money is stored as integer pounds for sale
// prices and integer pcm for rents (no floats)."
describe('formatPrice', () => {
  it('formats a sale price with thousands separators', () => {
    expect(
      formatPrice({ channel: 'sale', price: 350000, priceQualifier: 'fixed' }),
    ).toBe('£350,000')
  })

  it('appends the qualifier for sale when not "fixed"', () => {
    expect(
      formatPrice({
        channel: 'sale',
        price: 500000,
        priceQualifier: 'guide_price',
      }),
    ).toBe('Guide price £500,000')
    expect(
      formatPrice({
        channel: 'sale',
        price: 500000,
        priceQualifier: 'offers_over',
      }),
    ).toBe('Offers over £500,000')
    expect(
      formatPrice({
        channel: 'sale',
        price: 500000,
        priceQualifier: 'offers_in_region',
      }),
    ).toBe('Offers in region of £500,000')
  })

  it('renders POA regardless of the stored price', () => {
    expect(
      formatPrice({ channel: 'sale', price: 0, priceQualifier: 'poa' }),
    ).toBe('POA')
  })

  it('formats a rent price as pcm', () => {
    expect(
      formatPrice({ channel: 'rent', price: 1300, priceQualifier: 'fixed' }),
    ).toBe('£1,300 pcm')
  })

  it('formats rent POA without pcm', () => {
    expect(
      formatPrice({ channel: 'rent', price: 0, priceQualifier: 'poa' }),
    ).toBe('POA')
  })
})

// M3-DESIGN-SPEC.md §1.2 — the compact pin label, distinct from
// formatPrice() (that one is built for full running text; a pin needs a
// form that fits ~60px of chip).
describe('formatPinPrice', () => {
  it('abbreviates a sub-£1m sale price to the nearest thousand', () => {
    expect(formatPinPrice('sale', 350_000)).toBe('£350k')
  })

  it('rounds a sub-£1m sale price to the nearest thousand', () => {
    expect(formatPinPrice('sale', 349_600)).toBe('£350k')
    expect(formatPinPrice('sale', 349_400)).toBe('£349k')
  })

  it('formats a £1m-and-over sale price in millions to one decimal place', () => {
    expect(formatPinPrice('sale', 1_000_000)).toBe('£1m')
    expect(formatPinPrice('sale', 1_250_000)).toBe('£1.3m')
    expect(formatPinPrice('sale', 2_400_000)).toBe('£2.4m')
  })

  it('strips a trailing .0 at the million threshold', () => {
    expect(formatPinPrice('sale', 3_000_000)).toBe('£3m')
  })

  it('always shows the full pcm figure for rent, never abbreviated', () => {
    expect(formatPinPrice('rent', 1_300)).toBe('£1,300 pcm')
    expect(formatPinPrice('rent', 950)).toBe('£950 pcm')
  })
})
