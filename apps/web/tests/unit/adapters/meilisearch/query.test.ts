import { describe, expect, it } from 'vitest'

import {
  buildFilterExpression,
  buildSortExpression,
  mapFacetDistribution,
  resolveMeilisearchIndexName,
} from '@/adapters/meilisearch'
import type { SearchQuery } from '@/ports/search-index'

// Pure translation helpers behind MeilisearchSearchIndex (PRD §8.6) —
// unit-testable with no live daemon. The full round trip (these
// expressions actually narrowing a real Meilisearch index) is proven by
// tests/integration/meilisearch-adapter.test.ts.

function query(overrides: Partial<SearchQuery> = {}): SearchQuery {
  return {
    channel: 'sale',
    page: 1,
    ...overrides,
  }
}

describe('resolveMeilisearchIndexName', () => {
  it('defaults to the "doorstep" prefix when MEILISEARCH_INDEX_PREFIX is unset', () => {
    expect(resolveMeilisearchIndexName({})).toBe('doorstep-listings')
  })

  it('uses MEILISEARCH_INDEX_PREFIX when set', () => {
    expect(
      resolveMeilisearchIndexName({
        MEILISEARCH_INDEX_PREFIX: 'doorstep-ci-42',
      }),
    ).toBe('doorstep-ci-42-listings')
  })
})

describe('buildFilterExpression', () => {
  it('always includes the required channel filter, quoted', () => {
    expect(buildFilterExpression(query({ channel: 'rent' }))).toBe(
      'channel = "rent"',
    )
  })

  it('AND-joins price bounds, both inclusive', () => {
    const expr = buildFilterExpression(
      query({ filters: { priceMin: 200000, priceMax: 400000 } }),
    )
    expect(expr).toBe(
      'channel = "sale" AND price >= 200000 AND price <= 400000',
    )
  })

  it('AND-joins bedroom/bathroom bounds', () => {
    const expr = buildFilterExpression(
      query({
        filters: { bedroomsMin: 2, bedroomsMax: 4, bathroomsMin: 1 },
      }),
    )
    expect(expr).toBe(
      'channel = "sale" AND bedrooms >= 2 AND bedrooms <= 4 AND bathrooms >= 1',
    )
  })

  it('OR-joins multiple property types inside one parenthesised, AND-ed group', () => {
    const expr = buildFilterExpression(
      query({ filters: { propertyTypes: ['flat', 'terraced'] } }),
    )
    expect(expr).toBe(
      'channel = "sale" AND (propertyType = "flat" OR propertyType = "terraced")',
    )
  })

  it('omits the propertyType group entirely when the list is empty', () => {
    expect(
      buildFilterExpression(query({ filters: { propertyTypes: [] } })),
    ).toBe('channel = "sale"')
  })

  it('quotes tenure, furnished, town and outcode', () => {
    const expr = buildFilterExpression(
      query({
        filters: {
          tenure: 'freehold',
          furnished: 'furnished',
          town: 'Reading',
          outcode: 'RG30',
        },
      }),
    )
    expect(expr).toBe(
      'channel = "sale" AND tenure = "freehold" AND furnished = "furnished" AND town = "Reading" AND outcode = "RG30"',
    )
  })

  it('filters availableFrom with a quoted less-than comparison', () => {
    const expr = buildFilterExpression(
      query({ filters: { availableFromBefore: '2026-09-01' } }),
    )
    expect(expr).toBe('channel = "sale" AND availableFrom < "2026-09-01"')
  })

  it('renders newHome as an unquoted boolean', () => {
    expect(buildFilterExpression(query({ filters: { newHome: true } }))).toBe(
      'channel = "sale" AND newHome = true',
    )
  })

  it('appends a _geoRadius clause for a radius query', () => {
    const expr = buildFilterExpression(
      query({
        geo: { kind: 'radius', lat: 51.4543, lng: -0.9781, radiusMetres: 3000 },
      }),
    )
    expect(expr).toBe('channel = "sale" AND _geoRadius(51.4543, -0.9781, 3000)')
  })

  it('appends a _geoBoundingBox clause for a bbox query', () => {
    const expr = buildFilterExpression(
      query({
        geo: {
          kind: 'bbox',
          topRight: { lat: 51.5, lng: -0.9 },
          bottomLeft: { lat: 51.4, lng: -1.0 },
        },
      }),
    )
    expect(expr).toBe(
      'channel = "sale" AND _geoBoundingBox([51.5, -0.9], [51.4, -1])',
    )
  })

  it('combines every clause with AND, in a stable order', () => {
    const expr = buildFilterExpression(
      query({
        channel: 'rent',
        filters: { priceMax: 2000, furnished: 'unfurnished' },
        geo: { kind: 'radius', lat: 51.4543, lng: -0.9781, radiusMetres: 5000 },
      }),
    )
    expect(expr).toBe(
      'channel = "rent" AND price <= 2000 AND furnished = "unfurnished" AND _geoRadius(51.4543, -0.9781, 5000)',
    )
  })
})

describe('buildSortExpression', () => {
  it('defaults to publishedAt:desc when sort is omitted', () => {
    expect(buildSortExpression(undefined)).toEqual(['publishedAt:desc'])
  })

  it('maps "newest" to publishedAt:desc', () => {
    expect(buildSortExpression('newest')).toEqual(['publishedAt:desc'])
  })

  it('maps "price_asc" to price:asc', () => {
    expect(buildSortExpression('price_asc')).toEqual(['price:asc'])
  })

  it('maps "price_desc" to price:desc', () => {
    expect(buildSortExpression('price_desc')).toEqual(['price:desc'])
  })
})

describe('mapFacetDistribution', () => {
  it('defaults propertyType to an empty object when the response has no distribution at all', () => {
    expect(mapFacetDistribution(undefined)).toEqual({ propertyType: {} })
  })

  it("passes each requested facet's counts through, omitting keys absent from the response", () => {
    expect(
      mapFacetDistribution({
        propertyType: { flat: 3, terraced: 5 },
        tenure: { freehold: 8 },
      }),
    ).toEqual({
      propertyType: { flat: 3, terraced: 5 },
      tenure: { freehold: 8 },
    })
  })
})
