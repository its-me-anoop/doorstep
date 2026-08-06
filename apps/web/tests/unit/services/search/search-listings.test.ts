import { describe, expect, it } from 'vitest'

import { milesToMetres } from '@/domain/distance'
import type { SearchQueryInput } from '@/lib/validation/search'
import type { ListingSearchDocument } from '@/ports/search-index'
import { SearchListings } from '@/services/search/search-listings'
import { SearchUnavailableError } from '@/services/search/errors'

import { FakeSearchIndex } from '../search-sync/fakes'

function input(overrides: Partial<SearchQueryInput> = {}): SearchQueryInput {
  return {
    channel: 'sale',
    sort: 'newest',
    page: 1,
    ...overrides,
  }
}

function document(
  overrides: Partial<ListingSearchDocument> = {},
): ListingSearchDocument {
  return {
    id: 'listing-1',
    slug: 'charming-terraced-house-rg30-ab12cd',
    status: 'published',
    channel: 'sale',
    title: 'Charming terraced house',
    displayAddress: '12 Example Street, Reading',
    town: 'Reading',
    outcode: 'RG30',
    propertyType: 'terraced',
    bedrooms: 3,
    bathrooms: 1,
    price: 350000,
    priceQualifier: 'guide_price',
    tenure: 'freehold',
    furnished: null,
    availableFrom: null,
    newHome: false,
    features: ['garden'],
    coverImageUrl: 'https://example.test/cover.webp',
    imageCount: 4,
    agency: { id: 'agency-1', name: 'Thameside Homes', logoUrl: null },
    publishedAt: 1_770_000_000,
    _geo: { lat: 51.4543, lng: -0.9781 },
    ...overrides,
  }
}

describe('SearchListings', () => {
  describe('translating the validated query into a SearchQuery', () => {
    it('passes channel, sort and page straight through', async () => {
      const searchIndex = new FakeSearchIndex()
      const searchListings = new SearchListings(searchIndex)

      await searchListings.execute(
        input({ channel: 'rent', sort: 'price_asc', page: 3 }),
      )

      expect(searchIndex.lastSearchQuery).toMatchObject({
        channel: 'rent',
        sort: 'price_asc',
        page: 3,
      })
    })

    it('omits geo entirely when neither radius nor bbox params are given', async () => {
      const searchIndex = new FakeSearchIndex()
      const searchListings = new SearchListings(searchIndex)

      await searchListings.execute(input())

      expect(searchIndex.lastSearchQuery?.geo).toBeUndefined()
    })

    it('builds a radius geo query, converting miles to metres', async () => {
      const searchIndex = new FakeSearchIndex()
      const searchListings = new SearchListings(searchIndex)

      await searchListings.execute(
        input({ lat: 51.4543, lng: -0.9781, radiusMiles: 3 }),
      )

      expect(searchIndex.lastSearchQuery?.geo).toEqual({
        kind: 'radius',
        lat: 51.4543,
        lng: -0.9781,
        radiusMetres: milesToMetres(3),
      })
    })

    it('defaults radiusMiles to 1 (this-area-only) when lat/lng are given without it', async () => {
      const searchIndex = new FakeSearchIndex()
      const searchListings = new SearchListings(searchIndex)

      await searchListings.execute(input({ lat: 51.4543, lng: -0.9781 }))

      expect(searchIndex.lastSearchQuery?.geo).toEqual({
        kind: 'radius',
        lat: 51.4543,
        lng: -0.9781,
        radiusMetres: milesToMetres(1),
      })
    })

    it('builds a bbox geo query from the four bbox corners', async () => {
      const searchIndex = new FakeSearchIndex()
      const searchListings = new SearchListings(searchIndex)

      await searchListings.execute(
        input({
          bboxNeLat: 51.5,
          bboxNeLng: -0.9,
          bboxSwLat: 51.4,
          bboxSwLng: -1.0,
        }),
      )

      expect(searchIndex.lastSearchQuery?.geo).toEqual({
        kind: 'bbox',
        topRight: { lat: 51.5, lng: -0.9 },
        bottomLeft: { lat: 51.4, lng: -1.0 },
      })
    })

    it('maps every filter field to the SearchQueryFilters shape', async () => {
      const searchIndex = new FakeSearchIndex()
      const searchListings = new SearchListings(searchIndex)

      await searchListings.execute(
        input({
          priceMin: 200000,
          priceMax: 400000,
          bedsMin: 2,
          bedsMax: 4,
          bathsMin: 1,
          types: ['flat', 'terraced'],
          tenure: 'freehold',
          furnished: 'furnished',
          availableBy: '2026-09-01',
          newHome: true,
          town: 'Reading',
          outcode: 'RG30',
        }),
      )

      expect(searchIndex.lastSearchQuery?.filters).toEqual({
        priceMin: 200000,
        priceMax: 400000,
        bedroomsMin: 2,
        bedroomsMax: 4,
        bathroomsMin: 1,
        propertyTypes: ['flat', 'terraced'],
        tenure: 'freehold',
        furnished: 'furnished',
        availableFromBefore: '2026-09-01',
        newHome: true,
        town: 'Reading',
        outcode: 'RG30',
      })
    })

    it('omits filters keys that were not supplied', async () => {
      const searchIndex = new FakeSearchIndex()
      const searchListings = new SearchListings(searchIndex)

      await searchListings.execute(input({ priceMin: 200000 }))

      expect(searchIndex.lastSearchQuery?.filters).toEqual({
        priceMin: 200000,
      })
    })
  })

  describe('mapping hits to the public DTO', () => {
    it('maps every field, including geo and a channel-derived displayStatus', async () => {
      const searchIndex = new FakeSearchIndex()
      await searchIndex.upsert([document()])
      const searchListings = new SearchListings(searchIndex)

      const result = await searchListings.execute(input())

      expect(result.results).toEqual([
        {
          id: 'listing-1',
          slug: 'charming-terraced-house-rg30-ab12cd',
          channel: 'sale',
          title: 'Charming terraced house',
          displayAddress: '12 Example Street, Reading',
          town: 'Reading',
          outcode: 'RG30',
          propertyType: 'terraced',
          bedrooms: 3,
          bathrooms: 1,
          price: 350000,
          priceQualifier: 'guide_price',
          displayStatus: 'published',
          furnished: null,
          availableFrom: null,
          newHome: false,
          coverImageUrl: 'https://example.test/cover.webp',
          imageCount: 4,
          agency: { id: 'agency-1', name: 'Thameside Homes', logoUrl: null },
          publishedAt: 1_770_000_000,
          geo: { lat: 51.4543, lng: -0.9781 },
        },
      ])
    })

    it.each([
      ['sale', 'Sold STC'],
      ['rent', 'Let Agreed'],
    ] as const)(
      'derives displayStatus for an under_offer %s listing as %s',
      async (channel, expected) => {
        const searchIndex = new FakeSearchIndex()
        await searchIndex.upsert([document({ channel, status: 'under_offer' })])
        const searchListings = new SearchListings(searchIndex)

        const result = await searchListings.execute(input({ channel }))

        expect(result.results[0]?.displayStatus).toBe(expected)
      },
    )

    it('maps totalCount, page, totalPages and facets from the search result', async () => {
      const searchIndex = new FakeSearchIndex()
      await searchIndex.upsert([document()])
      const searchListings = new SearchListings(searchIndex)

      const result = await searchListings.execute(input({ page: 1 }))

      expect(result.totalCount).toBe(1)
      expect(result.page).toBe(1)
      expect(result.totalPages).toBe(1)
      expect(result.facets).toEqual({ propertyType: {} })
    })

    it('maps a null agency through as null', async () => {
      const searchIndex = new FakeSearchIndex()
      await searchIndex.upsert([document({ agency: null })])
      const searchListings = new SearchListings(searchIndex)

      const result = await searchListings.execute(input())

      expect(result.results[0]?.agency).toBeNull()
    })
  })

  describe('graceful degradation', () => {
    it('wraps a search() failure in SearchUnavailableError', async () => {
      const searchIndex = new FakeSearchIndex()
      searchIndex.search = async () => {
        throw new Error('ECONNREFUSED')
      }
      const searchListings = new SearchListings(searchIndex)

      await expect(searchListings.execute(input())).rejects.toThrow(
        SearchUnavailableError,
      )
    })
  })
})
