import { describe, expect, it, vi } from 'vitest'

import { MeilisearchSearchIndex } from '@/adapters/meilisearch'
import { fetchInitialSearchResult } from '@/lib/server-search'
import { SearchUnavailableError } from '@/services/search'
import { SearchListings } from '@/services/search/search-listings'

// The SSR path behind the four results pages (PRD §8.3: "the shell
// server-renders with initial results"). Translates the URL state
// through the exact same `searchQuerySchema` GET /api/v1/search
// validates, so a server-rendered first page and a client re-query for
// the same URL can never disagree about what the query means.
describe('fetchInitialSearchResult', () => {
  it('parses the state into a SearchQueryInput and calls SearchListings.execute', async () => {
    const execute = vi.fn().mockResolvedValue({
      results: [],
      totalCount: 0,
      page: 1,
      totalPages: 1,
      facets: { propertyType: {} },
    })
    const searchListings = { execute } as unknown as SearchListings

    const result = await fetchInitialSearchResult(
      searchListings,
      { minBeds: 2 },
      'sale',
    )

    expect(execute).toHaveBeenCalledWith(
      expect.objectContaining({
        channel: 'sale',
        bedsMin: 2,
        sort: 'newest',
        page: 1,
      }),
    )
    expect(result).toEqual({
      results: [],
      totalCount: 0,
      page: 1,
      totalPages: 1,
      facets: { propertyType: {} },
    })
  })

  it('merges an area filter into the query when provided (§4 area landing pages)', async () => {
    const execute = vi.fn().mockResolvedValue({
      results: [],
      totalCount: 0,
      page: 1,
      totalPages: 1,
      facets: { propertyType: {} },
    })
    const searchListings = { execute } as unknown as SearchListings

    await fetchInitialSearchResult(searchListings, { minBeds: 2 }, 'sale', {
      town: 'Reading',
    })

    expect(execute).toHaveBeenCalledWith(
      expect.objectContaining({ town: 'Reading', bedsMin: 2 }),
    )
  })

  it('returns an empty listing page on SearchUnavailableError so first paint is not the outage panel', async () => {
    const execute = vi.fn().mockRejectedValue(new SearchUnavailableError())
    const searchListings = { execute } as unknown as SearchListings

    const result = await fetchInitialSearchResult(searchListings, {}, 'sale')

    expect(result).toEqual({
      results: [],
      totalCount: 0,
      page: 1,
      totalPages: 0,
      facets: { propertyType: {} },
    })
  })

  it('returns empty listings (not null) when Meilisearch host is unset — the preview first-load path', async () => {
    const consoleError = vi
      .spyOn(console, 'error')
      .mockImplementation(() => undefined)
    const searchListings = new SearchListings(new MeilisearchSearchIndex({}))

    const result = await fetchInitialSearchResult(searchListings, {}, 'sale')

    expect(result.results).toEqual([])
    expect(result.totalCount).toBe(0)
    consoleError.mockRestore()
  })

  it('re-throws any other error', async () => {
    const execute = vi.fn().mockRejectedValue(new Error('boom'))
    const searchListings = { execute } as unknown as SearchListings

    await expect(
      fetchInitialSearchResult(searchListings, {}, 'sale'),
    ).rejects.toThrow('boom')
  })
})
