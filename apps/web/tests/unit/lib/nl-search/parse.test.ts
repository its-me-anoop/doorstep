import { describe, expect, it } from 'vitest'

import { parseNaturalLanguageSearch } from '@/lib/nl-search/parse'

// Plain-English search — the rule-based core. Every expectation here is
// against the *existing* URL vocabulary (lib/search-url.ts's
// SearchUrlState); the parser never invents a filter the results page
// couldn't already read off the address bar.

const NOW = new Date('2026-09-14T12:00:00Z')

function parse(text: string) {
  return parseNaturalLanguageSearch(text, { now: NOW })
}

describe('parseNaturalLanguageSearch', () => {
  describe('the headline example', () => {
    it('turns "2 bed flat in Reading under £350k with parking" into filters, a place and an honest gap', () => {
      const result = parse('2 bed flat in Reading under £350k with parking')
      expect(result).toEqual({
        channel: undefined,
        filters: { minBeds: 2, maxPrice: 350_000, type: ['flat'] },
        place: 'Reading',
        unsupported: ['Parking'],
        residual: '',
        residualFragments: [],
        understood: true,
      })
    })

    it('handles a full rental sentence', () => {
      const result = parse(
        'unfurnished 3 bed house to rent in RG4 for around £1,800 pcm from October',
      )
      expect(result.channel).toBe('rent')
      expect(result.place).toBe('RG4')
      expect(result.filters).toEqual({
        minBeds: 3,
        minPrice: 1_600,
        maxPrice: 2_000,
        type: ['detached', 'semi_detached', 'terraced'],
        furnished: ['unfurnished'],
        availableFrom: '2026-10-01',
      })
      expect(result.residual).toBe('')
    })
  })

  describe('bedrooms', () => {
    it.each([
      ['2 bed', { minBeds: 2 }],
      ['2-bed', { minBeds: 2 }],
      ['two bedroom', { minBeds: 2 }],
      ['3 bedrooms', { minBeds: 3 }],
      ['3+ beds', { minBeds: 3 }],
      ['3 beds or more', { minBeds: 3 }],
      ['at least 4 bedrooms', { minBeds: 4 }],
      ['more than 2 bedrooms', { minBeds: 3 }],
      ['exactly 2 bedrooms', { minBeds: 2, maxBeds: 2 }],
      ['up to 3 beds', { maxBeds: 3 }],
      ['max 3 bed', { maxBeds: 3 }],
      ['fewer than 3 beds', { maxBeds: 2 }],
      ['2-3 bed', { minBeds: 2, maxBeds: 3 }],
      ['2 to 3 bedrooms', { minBeds: 2, maxBeds: 3 }],
      ['two or three bedroom', { minBeds: 2, maxBeds: 3 }],
      ['two double bedrooms', { minBeds: 2 }],
      ['8 bed', { minBeds: 6 }],
    ])('"%s" → %o', (text, expected) => {
      expect(parse(text).filters).toMatchObject(expected)
    })

    it('reads "studio" as zero beds and a flat', () => {
      expect(parse('studio to rent').filters).toEqual({
        minBeds: 0,
        maxBeds: 0,
        type: ['flat'],
      })
    })

    it('reports a bathroom count as unsupported rather than faking a filter', () => {
      const result = parse('2 bed 2 bath')
      expect(result.filters).toEqual({ minBeds: 2 })
      expect(result.unsupported).toEqual(['2 bathrooms'])
    })
  })

  describe('price', () => {
    it.each([
      ['under £350k', { maxPrice: 350_000 }],
      ['under 350k', { maxPrice: 350_000 }],
      ['below £350,000', { maxPrice: 350_000 }],
      ['up to 1.5m', { maxPrice: 1_500_000 }],
      ['max £400k', { maxPrice: 400_000 }],
      ['budget of 300k', { maxPrice: 300_000 }],
      ['£300k max', { maxPrice: 300_000 }],
      ['over £250k', { minPrice: 250_000 }],
      ['from £250k', { minPrice: 250_000 }],
      ['at least 200,000', { minPrice: 200_000 }],
      ['£250k+', { minPrice: 250_000 }],
      ['between £200k and £300k', { minPrice: 200_000, maxPrice: 300_000 }],
      ['200-300k', { minPrice: 200_000, maxPrice: 300_000 }],
      ['£200,000 to £300,000', { minPrice: 200_000, maxPrice: 300_000 }],
      ['between 200 and 300k', { minPrice: 200_000, maxPrice: 300_000 }],
      ['around £300k', { minPrice: 270_000, maxPrice: 330_000 }],
      ['350k ish', { minPrice: 315_000, maxPrice: 385_000 }],
    ])('"%s" → %o', (text, expected) => {
      expect(parse(text).filters).toEqual(expected)
    })

    it('reads a bare figure as a ceiling', () => {
      expect(parse('penthouse £1.5m Reading').filters).toEqual({
        maxPrice: 1_500_000,
        type: ['flat'],
      })
    })

    it('reads a monthly unit as rent, in pounds per calendar month', () => {
      const result = parse('under £1,200 pcm')
      expect(result.channel).toBe('rent')
      expect(result.filters).toEqual({ maxPrice: 1_200 })
    })

    it('converts a weekly rent to monthly at 52/12', () => {
      const result = parse('flat for £500 per week')
      expect(result.channel).toBe('rent')
      expect(result.filters.maxPrice).toBe(2_167)
    })

    it('treats a bare sub-£10k budget as a rent cue', () => {
      const result = parse('under 900')
      expect(result.channel).toBe('rent')
      expect(result.filters).toEqual({ maxPrice: 900 })
    })

    it('does not treat small bounded numbers as prices', () => {
      expect(parse('for 2 people').filters).toEqual({})
      expect(parse('over 3 floors').filters).toEqual({})
    })

    it('does not read "5 mins" as five million', () => {
      expect(parse('5 mins from the station').filters).toEqual({})
    })

    it('rounds an approximate rent to the nearest £50', () => {
      expect(parse('around £1,200 pcm').filters).toEqual({
        minPrice: 1_100,
        maxPrice: 1_300,
      })
    })
  })

  describe('channel cues', () => {
    it.each([
      ['2 bed to rent', 'rent'],
      ['flats for rent', 'rent'],
      ['house to let', 'rent'],
      ['rental in Reading', 'rent'],
      ['2 bed to buy', 'sale'],
      ['houses for sale', 'sale'],
      ['first time buyer', 'sale'],
      ['2 bed flat', undefined],
    ])('"%s" → %s', (text, expected) => {
      expect(parse(text).channel).toBe(expected)
    })

    it('treats rent-only fields as a soft rent cue', () => {
      expect(parse('furnished flat').channel).toBe('rent')
      expect(parse('available from October').channel).toBe('rent')
    })

    it('lets an explicit cue win over a soft one', () => {
      expect(parse('furnished house for sale').channel).toBe('sale')
    })

    it('abstains when explicit cues conflict', () => {
      expect(parse('to rent or to buy').channel).toBeUndefined()
    })
  })

  describe('property types', () => {
    it.each([
      ['flat', ['flat']],
      ['apartments', ['flat']],
      ['penthouse', ['flat']],
      ['detached house', ['detached']],
      ['semi-detached', ['semi_detached']],
      ['semi detached', ['semi_detached']],
      ['a semi', ['semi_detached']],
      ['terraced', ['terraced']],
      ['end of terrace', ['terraced']],
      ['townhouse', ['terraced']],
      ['bungalow', ['bungalow']],
      ['maisonette', ['maisonette']],
      ['building plot', ['land']],
      ['house', ['detached', 'semi_detached', 'terraced']],
      ['cottage', ['detached', 'semi_detached', 'terraced']],
      ['flat or house', ['detached', 'flat', 'semi_detached', 'terraced']],
    ])('"%s" → %o', (text, expected) => {
      expect(parse(text).filters.type).toEqual(expected)
    })

    it('does not mistake "roof terrace" for a terraced house', () => {
      const result = parse('flat with a roof terrace')
      expect(result.filters.type).toEqual(['flat'])
      expect(result.unsupported).toEqual(['Balcony'])
    })
  })

  describe('furnishing', () => {
    it.each([
      ['furnished', ['furnished']],
      ['fully furnished', ['furnished']],
      ['unfurnished', ['unfurnished']],
      ['part furnished', ['part_furnished']],
      ['part-furnished', ['part_furnished']],
      ['furnished or unfurnished', ['furnished', 'unfurnished']],
    ])('"%s" → %o', (text, expected) => {
      expect(parse(text).filters.furnished).toEqual(expected)
    })
  })

  describe('availability', () => {
    it.each([
      ['available now', '2026-09-14'],
      ['asap', '2026-09-14'],
      ['from October', '2026-10-01'],
      ['available from 1st October', '2026-10-01'],
      ['from 15 Nov 2026', '2026-11-15'],
      ['move in by Dec 1st', '2026-12-01'],
      ['available from 5 Jan', '2027-01-05'],
      ['from 01/10', '2026-10-01'],
      ['available 1/12/2026', '2026-12-01'],
    ])('"%s" → %s', (text, expected) => {
      expect(parse(text).filters.availableFrom).toBe(expected)
    })

    it('rolls a past month/day into next year', () => {
      expect(parse('from March').filters.availableFrom).toBe('2027-03-01')
    })

    it('does not read the modal verb "may" as a month', () => {
      expect(
        parse('it may have a garden').filters.availableFrom,
      ).toBeUndefined()
      expect(parse('from May').filters.availableFrom).toBe('2027-05-01')
    })

    it('rejects impossible dates', () => {
      expect(parse('from 31 February').filters.availableFrom).toBeUndefined()
    })
  })

  describe('sort, view and radius', () => {
    it.each([
      ['cheapest first', 'price_asc'],
      ['cheap flats', 'price_asc'],
      ['low to high', 'price_asc'],
      ['most expensive first', 'price_desc'],
      ['newest first', undefined],
    ])('"%s" → sort %s', (text, expected) => {
      expect(parse(text).filters.sort).toBe(expected)
    })

    it('reads "on a map" as the map view', () => {
      expect(parse('show me flats on a map').filters.view).toBe('map')
    })

    it('snaps a radius to the nearest allowed option and keeps the place', () => {
      const result = parse('within 4 miles of Wokingham')
      expect(result.filters.radius).toBe(3)
      expect(result.place).toBe('Wokingham')
    })

    it('converts kilometres', () => {
      expect(parse('within 10 km of Reading').filters.radius).toBe(5)
    })
  })

  describe('place', () => {
    it.each([
      ['2 bed in Reading', 'Reading'],
      ['2 bed near Caversham Heights', 'Caversham Heights'],
      ['close to Earley under 300k', 'Earley'],
      ['in Kingston upon Thames', 'Kingston upon Thames'],
      ['in Henley-on-Thames', 'Henley-on-Thames'],
      ['flat near Reading station', 'Reading station'],
      ['in Reading please', 'Reading'],
      ['in reading with a park', 'reading'],
      ['RG1 8BT 1 bed', 'RG1 8BT'],
      ['rg4 flats', 'RG4'],
      ['Reading 2 bed flat', 'Reading'],
      ['reading 2 bed flat', 'Reading'],
      ['2 bed flat Basingstoke', 'Basingstoke'],
      ['emmer green bungalows', 'Emmer Green'],
    ])('"%s" → %s', (text, expected) => {
      expect(parse(text).place).toBe(expected)
    })

    it('leaves a descriptive phrase alone', () => {
      const result = parse('2 bed flat in a quiet area')
      expect(result.place).toBeUndefined()
      expect(result.residual).toBe('quiet area')
    })

    it('does not geocode an adjective', () => {
      const result = parse('Cheap 2 bed flat')
      expect(result.place).toBeUndefined()
    })

    it('does not read a motorway as a postcode district', () => {
      const result = parse('house near the M4 under 400k')
      expect(result.place).toBeUndefined()
      expect(result.unsupported).toEqual(['Near amenities'])
    })

    it('does not read an amenity as a place', () => {
      const result = parse('flat near the station')
      expect(result.place).toBeUndefined()
      expect(result.unsupported).toEqual(['Near amenities'])
    })
  })

  describe('unsupported wishes', () => {
    it.each([
      ['with parking', 'Parking'],
      ['with a garage', 'Parking'],
      ['with a garden', 'Garden'],
      ['pets allowed', 'Pets allowed'],
      ['with a dog', 'Pets allowed'],
      ['bills included', 'Bills included'],
      ['en suite', 'En suite'],
      ['new build', 'New build'],
      ['no chain', 'Chain free'],
      ['ground floor', 'Accessibility'],
      ['victorian terrace', 'Period property'],
      ['good transport links', 'Near amenities'],
    ])('"%s" → %s', (text, expected) => {
      expect(parse(text).unsupported).toContain(expected)
    })

    it('de-duplicates', () => {
      expect(parse('parking and a garage').unsupported).toEqual(['Parking'])
    })
  })

  describe('residual and understood', () => {
    it('is empty and understood for a fully-parsed sentence', () => {
      const result = parse('find me a 2 bed flat in Reading please')
      expect(result.residual).toBe('')
      expect(result.understood).toBe(true)
    })

    it('keeps substantive leftovers, split at what was understood', () => {
      const result = parse(
        'cottage in Woodley with a log burner, 2 beds, on a quiet street',
      )
      expect(result.place).toBe('Woodley')
      expect(result.filters.minBeds).toBe(2)
      expect(result.residualFragments).toEqual(['log burner', 'quiet street'])
      expect(result.residual).toBe('log burner quiet street')
    })

    it('is not understood when nothing matched', () => {
      const result = parse('something lovely')
      expect(result.understood).toBe(false)
      expect(result.filters).toEqual({})
    })

    it('never throws on odd input', () => {
      for (const text of ['', '   ', '£', '???', '2', 'bed', '£££ k m']) {
        expect(() => parse(text)).not.toThrow()
      }
    })
  })
})
