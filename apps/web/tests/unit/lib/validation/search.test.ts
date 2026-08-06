import { describe, expect, it } from 'vitest'

import { searchQuerySchema } from '@/lib/validation/search'

// GET /api/v1/search's query schema (PRD §10). Every field arrives as a
// string (or is absent) straight off URLSearchParams — this suite feeds
// exactly that shape, never pre-coerced values, matching how the route
// itself will call safeParse (lib/validation/search.ts's own doc comment).
function raw(overrides: Record<string, string | undefined> = {}) {
  return { channel: 'sale', ...overrides }
}

describe('searchQuerySchema', () => {
  it('accepts the minimal required shape and defaults sort/page', () => {
    const result = searchQuerySchema.safeParse(raw())

    expect(result.success).toBe(true)
    if (!result.success) return
    expect(result.data.channel).toBe('sale')
    expect(result.data.sort).toBe('newest')
    expect(result.data.page).toBe(1)
    expect(result.data.lat).toBeUndefined()
    expect(result.data.radiusMiles).toBeUndefined()
  })

  it('rejects a missing channel', () => {
    const result = searchQuerySchema.safeParse({})
    expect(result.success).toBe(false)
  })

  it('rejects an invalid channel', () => {
    const result = searchQuerySchema.safeParse(raw({ channel: 'lease' }))
    expect(result.success).toBe(false)
  })

  describe('radius geo', () => {
    it('accepts lat+lng+radiusMiles, coerced to numbers', () => {
      const result = searchQuerySchema.safeParse(
        raw({ lat: '51.4543', lng: '-0.9781', radiusMiles: '3' }),
      )
      expect(result.success).toBe(true)
      if (!result.success) return
      expect(result.data.lat).toBe(51.4543)
      expect(result.data.lng).toBe(-0.9781)
      expect(result.data.radiusMiles).toBe(3)
    })

    it('accepts lat+lng with radiusMiles omitted (service applies the default)', () => {
      const result = searchQuerySchema.safeParse(
        raw({ lat: '51.4543', lng: '-0.9781' }),
      )
      expect(result.success).toBe(true)
      if (!result.success) return
      expect(result.data.radiusMiles).toBeUndefined()
    })

    it('rejects lat without lng', () => {
      const result = searchQuerySchema.safeParse(raw({ lat: '51.4543' }))
      expect(result.success).toBe(false)
    })

    it('rejects lng without lat', () => {
      const result = searchQuerySchema.safeParse(raw({ lng: '-0.9781' }))
      expect(result.success).toBe(false)
    })

    it('rejects radiusMiles below 0.25', () => {
      const result = searchQuerySchema.safeParse(
        raw({ lat: '51.4543', lng: '-0.9781', radiusMiles: '0.1' }),
      )
      expect(result.success).toBe(false)
    })

    it('rejects radiusMiles above 30', () => {
      const result = searchQuerySchema.safeParse(
        raw({ lat: '51.4543', lng: '-0.9781', radiusMiles: '31' }),
      )
      expect(result.success).toBe(false)
    })

    it('rejects an out-of-range lat', () => {
      const result = searchQuerySchema.safeParse(
        raw({ lat: '95', lng: '-0.9781' }),
      )
      expect(result.success).toBe(false)
    })

    it('rejects junk (non-numeric) lat', () => {
      const result = searchQuerySchema.safeParse(
        raw({ lat: 'abc', lng: '-0.9781' }),
      )
      expect(result.success).toBe(false)
    })
  })

  describe('bounding-box geo', () => {
    function bbox() {
      return {
        bboxNeLat: '51.5',
        bboxNeLng: '-0.9',
        bboxSwLat: '51.4',
        bboxSwLng: '-1.0',
      }
    }

    it('accepts all four bbox params together', () => {
      const result = searchQuerySchema.safeParse(raw(bbox()))
      expect(result.success).toBe(true)
      if (!result.success) return
      expect(result.data.bboxNeLat).toBe(51.5)
      expect(result.data.bboxSwLng).toBe(-1)
    })

    it('rejects a partial bbox', () => {
      const partial = Object.fromEntries(
        Object.entries(bbox()).filter(([key]) => key !== 'bboxSwLng'),
      )
      const result = searchQuerySchema.safeParse(raw(partial))
      expect(result.success).toBe(false)
    })

    it('rejects bbox combined with a radius point', () => {
      const result = searchQuerySchema.safeParse(
        raw({ ...bbox(), lat: '51.4543', lng: '-0.9781' }),
      )
      expect(result.success).toBe(false)
    })
  })

  describe('numeric filters', () => {
    it('coerces and accepts priceMin/priceMax', () => {
      const result = searchQuerySchema.safeParse(
        raw({ priceMin: '200000', priceMax: '400000' }),
      )
      expect(result.success).toBe(true)
      if (!result.success) return
      expect(result.data.priceMin).toBe(200000)
      expect(result.data.priceMax).toBe(400000)
    })

    it('rejects priceMin greater than priceMax', () => {
      const result = searchQuerySchema.safeParse(
        raw({ priceMin: '400000', priceMax: '200000' }),
      )
      expect(result.success).toBe(false)
    })

    it('rejects bedsMin greater than bedsMax', () => {
      const result = searchQuerySchema.safeParse(
        raw({ bedsMin: '4', bedsMax: '2' }),
      )
      expect(result.success).toBe(false)
    })

    it('rejects a negative bathsMin', () => {
      const result = searchQuerySchema.safeParse(raw({ bathsMin: '-1' }))
      expect(result.success).toBe(false)
    })

    it('rejects a non-integer priceMin', () => {
      const result = searchQuerySchema.safeParse(raw({ priceMin: '1.5' }))
      expect(result.success).toBe(false)
    })
  })

  describe('types (comma multi-select)', () => {
    it('splits and validates a comma list', () => {
      const result = searchQuerySchema.safeParse(
        raw({ types: 'flat,terraced' }),
      )
      expect(result.success).toBe(true)
      if (!result.success) return
      expect(result.data.types).toEqual(['flat', 'terraced'])
    })

    it('trims whitespace around each entry', () => {
      const result = searchQuerySchema.safeParse(
        raw({ types: ' flat , terraced ' }),
      )
      expect(result.success).toBe(true)
      if (!result.success) return
      expect(result.data.types).toEqual(['flat', 'terraced'])
    })

    it('rejects an unknown property type', () => {
      const result = searchQuerySchema.safeParse(raw({ types: 'castle' }))
      expect(result.success).toBe(false)
    })

    it('treats an empty string as omitted', () => {
      const result = searchQuerySchema.safeParse(raw({ types: '' }))
      expect(result.success).toBe(true)
      if (!result.success) return
      expect(result.data.types).toBeUndefined()
    })
  })

  describe('tenure / furnished', () => {
    it('accepts a valid tenure', () => {
      const result = searchQuerySchema.safeParse(raw({ tenure: 'freehold' }))
      expect(result.success).toBe(true)
    })

    it('rejects an invalid tenure', () => {
      const result = searchQuerySchema.safeParse(raw({ tenure: 'nonsense' }))
      expect(result.success).toBe(false)
    })

    it('accepts a valid furnished value', () => {
      const result = searchQuerySchema.safeParse(
        raw({ channel: 'rent', furnished: 'furnished' }),
      )
      expect(result.success).toBe(true)
    })
  })

  describe('availableBy', () => {
    it('accepts a YYYY-MM-DD date', () => {
      const result = searchQuerySchema.safeParse(
        raw({ channel: 'rent', availableBy: '2026-09-01' }),
      )
      expect(result.success).toBe(true)
      if (!result.success) return
      expect(result.data.availableBy).toBe('2026-09-01')
    })

    it('rejects a malformed date', () => {
      const result = searchQuerySchema.safeParse(
        raw({ channel: 'rent', availableBy: '01/09/2026' }),
      )
      expect(result.success).toBe(false)
    })
  })

  describe('newHome', () => {
    it('coerces "true" to true', () => {
      const result = searchQuerySchema.safeParse(raw({ newHome: 'true' }))
      expect(result.success).toBe(true)
      if (!result.success) return
      expect(result.data.newHome).toBe(true)
    })

    it('coerces "false" to false', () => {
      const result = searchQuerySchema.safeParse(raw({ newHome: 'false' }))
      expect(result.success).toBe(true)
      if (!result.success) return
      expect(result.data.newHome).toBe(false)
    })

    it('rejects anything other than "true"/"false"', () => {
      const result = searchQuerySchema.safeParse(raw({ newHome: 'yes' }))
      expect(result.success).toBe(false)
    })
  })

  describe('town / outcode', () => {
    it('accepts non-empty strings', () => {
      const result = searchQuerySchema.safeParse(
        raw({ town: 'Reading', outcode: 'RG30' }),
      )
      expect(result.success).toBe(true)
    })

    it('rejects a blank town', () => {
      const result = searchQuerySchema.safeParse(raw({ town: '   ' }))
      expect(result.success).toBe(false)
    })
  })

  describe('sort', () => {
    it('accepts each valid sort value', () => {
      for (const sort of ['newest', 'price_asc', 'price_desc']) {
        expect(searchQuerySchema.safeParse(raw({ sort })).success).toBe(true)
      }
    })

    it('rejects an invalid sort value', () => {
      const result = searchQuerySchema.safeParse(raw({ sort: 'relevance' }))
      expect(result.success).toBe(false)
    })
  })

  describe('page', () => {
    it('defaults to 1 when omitted', () => {
      const result = searchQuerySchema.safeParse(raw())
      expect(result.success).toBe(true)
      if (!result.success) return
      expect(result.data.page).toBe(1)
    })

    it('accepts page 200 (the cap)', () => {
      const result = searchQuerySchema.safeParse(raw({ page: '200' }))
      expect(result.success).toBe(true)
    })

    it('rejects page 201 (over the cap)', () => {
      const result = searchQuerySchema.safeParse(raw({ page: '201' }))
      expect(result.success).toBe(false)
    })

    it('rejects page 0', () => {
      const result = searchQuerySchema.safeParse(raw({ page: '0' }))
      expect(result.success).toBe(false)
    })

    it('rejects a non-integer page', () => {
      const result = searchQuerySchema.safeParse(raw({ page: '1.5' }))
      expect(result.success).toBe(false)
    })
  })

  // M3-DESIGN-SPEC.md §1.3: "the map plots every matching hit in the
  // query" — a separate, larger window than the list's own 24/page,
  // requested via this param (search-url.ts's `buildMapSearchApiQuery`),
  // not the `page` field above (a different concern: `page` is the list
  // column's own paginated cursor into a fixed-size window, `hitsPerPage`
  // is the size of that window).
  describe('hitsPerPage', () => {
    it('is undefined when omitted (the adapter applies its own 24-item default)', () => {
      const result = searchQuerySchema.safeParse(raw())
      expect(result.success).toBe(true)
      if (!result.success) return
      expect(result.data.hitsPerPage).toBeUndefined()
    })

    it('accepts a value up to the 200 cap, coerced to a number', () => {
      const result = searchQuerySchema.safeParse(raw({ hitsPerPage: '200' }))
      expect(result.success).toBe(true)
      if (!result.success) return
      expect(result.data.hitsPerPage).toBe(200)
    })

    it('rejects a value over the 200 cap', () => {
      const result = searchQuerySchema.safeParse(raw({ hitsPerPage: '201' }))
      expect(result.success).toBe(false)
    })

    it('rejects 0', () => {
      const result = searchQuerySchema.safeParse(raw({ hitsPerPage: '0' }))
      expect(result.success).toBe(false)
    })

    it('rejects a non-integer value', () => {
      const result = searchQuerySchema.safeParse(raw({ hitsPerPage: '24.5' }))
      expect(result.success).toBe(false)
    })
  })
})
