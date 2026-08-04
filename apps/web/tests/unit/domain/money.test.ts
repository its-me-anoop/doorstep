import { describe, expect, it } from 'vitest'

import { formatPrice } from '@/domain/money'

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
