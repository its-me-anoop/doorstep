import { describe, expect, it } from 'vitest'

import {
  generateListingSlug,
  generateListingTitle,
} from '@/domain/listing-copy'

// PRD §9.2's example title ("3 bed semi-detached house for sale") and
// §7.2's example slug segment ("3-bed-semi-detached-house-rg30") are the
// only two data points the PRD gives — everything else here (rent
// phrasing, the 0-bedroom/studio case, the property-type label table, the
// slug's uniqueness suffix) is this module's own documented design
// decision, tested explicitly so a future change is deliberate.
describe('generateListingTitle', () => {
  it('matches the PRD §9.2 example exactly for a sale listing', () => {
    expect(
      generateListingTitle({
        bedrooms: 3,
        propertyType: 'semi_detached',
        channel: 'sale',
      }),
    ).toBe('3 bed semi-detached house for sale')
  })

  it('uses "to rent" for the rent channel', () => {
    expect(
      generateListingTitle({
        bedrooms: 2,
        propertyType: 'flat',
        channel: 'rent',
      }),
    ).toBe('2 bed flat to rent')
  })

  it.each([
    ['detached', 'detached house'],
    ['semi_detached', 'semi-detached house'],
    ['terraced', 'terraced house'],
    ['flat', 'flat'],
    ['bungalow', 'bungalow'],
    ['maisonette', 'maisonette'],
    ['land', 'land'],
    ['other', 'property'],
  ] as const)('labels property type %s as "%s"', (propertyType, label) => {
    expect(
      generateListingTitle({ bedrooms: 1, propertyType, channel: 'sale' }),
    ).toBe(`1 bed ${label} for sale`)
  })

  it('renders a 0-bedroom listing as "Studio", not "0 bed"', () => {
    expect(
      generateListingTitle({
        bedrooms: 0,
        propertyType: 'flat',
        channel: 'sale',
      }),
    ).toBe('Studio flat for sale')
  })

  it('does not pluralise "bed" for multiple bedrooms', () => {
    expect(
      generateListingTitle({
        bedrooms: 5,
        propertyType: 'detached',
        channel: 'sale',
      }),
    ).toBe('5 bed detached house for sale')
  })
})

describe('generateListingSlug', () => {
  it('matches the PRD §7.2 example base exactly, plus a suffix', () => {
    const slug = generateListingSlug({
      bedrooms: 3,
      propertyType: 'semi_detached',
      outcode: 'RG30',
      uniqueSeed: '01928374-65ea-72f1-8a3b-1122334455ff',
    })

    expect(slug.startsWith('3-bed-semi-detached-house-rg30-')).toBe(true)
  })

  it('lowercases the outcode', () => {
    const slug = generateListingSlug({
      bedrooms: 2,
      propertyType: 'flat',
      outcode: 'SW1A',
      uniqueSeed: '01928374-65ea-72f1-8a3b-1122334455ff',
    })

    expect(slug).toMatch(/^2-bed-flat-sw1a-[0-9a-f]{6}$/)
  })

  it('derives a 6-character hex suffix from the trailing characters of the seed uuid', () => {
    const slug = generateListingSlug({
      bedrooms: 1,
      propertyType: 'flat',
      outcode: 'RG1',
      uniqueSeed: '01928374-65ea-72f1-8a3b-1122334455ff',
    })

    expect(slug).toBe('1-bed-flat-rg1-4455ff')
  })

  it('produces different suffixes for different seeds, keeping the base identical', () => {
    const base = {
      bedrooms: 3,
      propertyType: 'semi_detached' as const,
      outcode: 'RG30',
    }

    const first = generateListingSlug({
      ...base,
      uniqueSeed: '01928374-65ea-72f1-8a3b-111111111111',
    })
    const second = generateListingSlug({
      ...base,
      uniqueSeed: '01928374-65ea-72f1-8a3b-222222222222',
    })

    expect(first).not.toBe(second)
    expect(first.replace(/-[0-9a-f]{6}$/, '')).toBe(
      second.replace(/-[0-9a-f]{6}$/, ''),
    )
  })

  it('renders a 0-bedroom listing slug as "studio", not "0-bed"', () => {
    const slug = generateListingSlug({
      bedrooms: 0,
      propertyType: 'flat',
      outcode: 'RG1',
      uniqueSeed: '01928374-65ea-72f1-8a3b-1122334455ff',
    })

    expect(slug).toBe('studio-flat-rg1-4455ff')
  })

  it('never emits the channel ("for-sale"/"to-rent") in the slug', () => {
    const slug = generateListingSlug({
      bedrooms: 3,
      propertyType: 'semi_detached',
      outcode: 'RG30',
      uniqueSeed: '01928374-65ea-72f1-8a3b-1122334455ff',
    })

    expect(slug).not.toContain('for-sale')
    expect(slug).not.toContain('to-rent')
  })

  it('handles an empty outcode (address not entered yet at draft creation)', () => {
    const slug = generateListingSlug({
      bedrooms: 2,
      propertyType: 'terraced',
      outcode: '',
      uniqueSeed: '01928374-65ea-72f1-8a3b-1122334455ff',
    })

    expect(slug).toBe('2-bed-terraced-house-4455ff')
  })
})
