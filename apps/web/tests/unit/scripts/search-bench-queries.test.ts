import { describe, expect, it } from 'vitest'

import {
  buildBenchQueries,
  percentile,
} from '../../../scripts/search-bench-queries'

describe('buildBenchQueries', () => {
  it('generates exactly the requested count', () => {
    expect(buildBenchQueries(300)).toHaveLength(300)
  })

  it('is deterministic — two calls produce identical output', () => {
    expect(buildBenchQueries(100)).toEqual(buildBenchQueries(100))
  })

  it('every query has a channel and a page between 1 and 3', () => {
    for (const query of buildBenchQueries(300)) {
      expect(['sale', 'rent']).toContain(query.get('channel'))
      const page = Number(query.get('page'))
      expect(page).toBeGreaterThanOrEqual(1)
      expect(page).toBeLessThanOrEqual(3)
    }
  })

  it('mixes in radius geo queries around Reading/Caversham/Earley', () => {
    const queries = buildBenchQueries(300)
    const withGeo = queries.filter((q) => q.has('lat'))
    expect(withGeo.length).toBeGreaterThan(0)
    for (const query of withGeo) {
      expect(query.has('lng')).toBe(true)
    }
  })

  it('mixes in every sort value', () => {
    const queries = buildBenchQueries(300)
    const sorts = new Set(queries.map((q) => q.get('sort')))
    expect(sorts).toEqual(new Set(['newest', 'price_asc', 'price_desc']))
  })

  it('mixes in filter combinations (price, beds, types)', () => {
    const queries = buildBenchQueries(300)
    expect(queries.some((q) => q.has('priceMin') || q.has('priceMax'))).toBe(
      true,
    )
    expect(queries.some((q) => q.has('bedsMin'))).toBe(true)
    expect(queries.some((q) => q.has('types'))).toBe(true)
  })

  it('every query serialises to a valid query string', () => {
    for (const query of buildBenchQueries(50)) {
      expect(() => query.toString()).not.toThrow()
    }
  })
})

describe('percentile', () => {
  it('returns the exact value for p50 on an odd-length sorted array', () => {
    expect(percentile([1, 2, 3, 4, 5], 50)).toBe(3)
  })

  it('returns the max for p100', () => {
    expect(percentile([1, 2, 3, 4, 5], 100)).toBe(5)
  })

  it('returns the min for p0', () => {
    expect(percentile([1, 2, 3, 4, 5], 0)).toBe(1)
  })

  it('handles an unsorted input by sorting internally', () => {
    expect(percentile([5, 1, 3, 2, 4], 50)).toBe(3)
  })

  it('handles a single-element array', () => {
    expect(percentile([42], 75)).toBe(42)
  })

  it('interpolates a reasonable p75 on a larger sample', () => {
    const values = Array.from({ length: 100 }, (_, i) => i + 1) // 1..100
    expect(percentile(values, 75)).toBeGreaterThanOrEqual(74)
    expect(percentile(values, 75)).toBeLessThanOrEqual(76)
  })
})
