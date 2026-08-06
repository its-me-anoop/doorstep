import { describe, expect, it } from 'vitest'

import { buildSearchHeading } from '@/lib/search-heading'

// M2-DESIGN-SPEC.md §3.1 point 2 — the <h1> is built from active
// filters, always an honest, specific description of what's shown.
describe('buildSearchHeading', () => {
  it('is "Homes for sale in Reading & the Thames Valley" for the unrestricted sale tier with no filters', () => {
    expect(
      buildSearchHeading({ channel: 'sale', state: {}, tier: 'unrestricted' }),
    ).toBe('Homes for sale in Reading & the Thames Valley')
  })

  it('is "Homes to rent in Reading & the Thames Valley" for the unrestricted rent tier', () => {
    expect(
      buildSearchHeading({ channel: 'rent', state: {}, tier: 'unrestricted' }),
    ).toBe('Homes to rent in Reading & the Thames Valley')
  })

  it('uses "near" and the label for the search tier', () => {
    expect(
      buildSearchHeading({
        channel: 'sale',
        state: { label: 'RG1 8BT' },
        tier: 'search',
      }),
    ).toBe('Homes for sale near RG1 8BT')
  })

  it('uses the plural type label for exactly one selected type', () => {
    expect(
      buildSearchHeading({
        channel: 'sale',
        state: { type: ['flat'] },
        tier: 'unrestricted',
      }),
    ).toBe('Flats for sale in Reading & the Thames Valley')
  })

  it('falls back to "Homes" for 2+ selected types', () => {
    expect(
      buildSearchHeading({
        channel: 'sale',
        state: { type: ['flat', 'terraced'] },
        tier: 'unrestricted',
      }),
    ).toBe('Homes for sale in Reading & the Thames Valley')
  })

  it('folds a minBeds filter in as an "N-bed" prefix', () => {
    expect(
      buildSearchHeading({
        channel: 'sale',
        state: { minBeds: 3 },
        tier: 'unrestricted',
      }),
    ).toBe('3-bed homes for sale in Reading & the Thames Valley')
  })

  it('combines a bed prefix with a single selected type', () => {
    expect(
      buildSearchHeading({
        channel: 'rent',
        state: { minBeds: 2, type: ['flat'] },
        tier: 'unrestricted',
      }),
    ).toBe('2-bed flats to rent in Reading & the Thames Valley')
  })

  // §4.1 point 1 — the area tier reuses the "in" preposition (like
  // unrestricted, not the search tier's "near"), naming the curated
  // area directly rather than state.label (which the area tier's URL
  // never carries — the area comes from the route segment).
  it('uses "in" and the area label for the area tier', () => {
    expect(
      buildSearchHeading({
        channel: 'sale',
        state: {},
        tier: 'area',
        areaLabel: 'Reading',
      }),
    ).toBe('Homes for sale in Reading')
  })

  it('folds filters into the area tier heading the same way as unrestricted', () => {
    expect(
      buildSearchHeading({
        channel: 'rent',
        state: { minBeds: 3 },
        tier: 'area',
        areaLabel: 'Caversham',
      }),
    ).toBe('3-bed homes to rent in Caversham')
  })
})
