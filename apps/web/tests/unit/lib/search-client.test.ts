import { afterEach, describe, expect, it, vi } from 'vitest'

import { fetchSearchResults, SearchApiError } from '@/lib/search-client'

function jsonResponse(body: unknown, status = 200): Response {
  return {
    ok: status >= 200 && status < 300,
    status,
    json: () => Promise.resolve(body),
  } as Response
}

// The browser-side fetch behind the results view's re-query on
// filter/sort/page change (M2-DESIGN-SPEC.md §1.10 point 2) and behind
// the outage panel's "Try again" button (point 4). Mirrors
// lib/listings-client.ts's request-helper shape rather than inventing a
// second convention.
describe('fetchSearchResults', () => {
  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('GETs /api/v1/search with the given query record and returns the data payload', async () => {
    const payload = {
      results: [],
      totalCount: 0,
      page: 1,
      totalPages: 1,
      facets: {},
    }
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse({ data: payload }))
    vi.stubGlobal('fetch', fetchMock)

    const result = await fetchSearchResults({
      channel: 'sale',
      minBeds: '2',
    })

    expect(fetchMock).toHaveBeenCalledWith(
      '/api/v1/search?channel=sale&minBeds=2',
    )
    expect(result).toEqual(payload)
  })

  it('omits undefined query values from the querystring', async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      jsonResponse({
        data: {
          results: [],
          totalCount: 0,
          page: 1,
          totalPages: 1,
          facets: {},
        },
      }),
    )
    vi.stubGlobal('fetch', fetchMock)

    await fetchSearchResults({ channel: 'sale', minBeds: undefined })

    expect(fetchMock).toHaveBeenCalledWith('/api/v1/search?channel=sale')
  })

  it('throws a SearchApiError with the 503 search_unavailable code on an index outage', async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      jsonResponse(
        {
          error: {
            code: 'search_unavailable',
            message:
              'Search is temporarily unavailable. Please try again shortly.',
          },
        },
        503,
      ),
    )
    vi.stubGlobal('fetch', fetchMock)

    await expect(fetchSearchResults({ channel: 'sale' })).rejects.toMatchObject(
      {
        code: 'search_unavailable',
      },
    )
  })

  it('throws a SearchApiError with a generic message when the error envelope has none', async () => {
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse({}, 500))
    vi.stubGlobal('fetch', fetchMock)

    await expect(
      fetchSearchResults({ channel: 'sale' }),
    ).rejects.toBeInstanceOf(SearchApiError)
  })
})
