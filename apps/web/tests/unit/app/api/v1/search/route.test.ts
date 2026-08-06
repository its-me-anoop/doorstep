import { NextRequest } from 'next/server'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { SearchUnavailableError } from '@/services/search'

const searchListings = { execute: vi.fn() }

vi.mock('@/lib/composition', () => ({
  createServices: () => ({
    search: { searchListings },
  }),
}))

function getRequest(search = ''): NextRequest {
  return new NextRequest(`https://doorstep.test/api/v1/search${search}`)
}

// GET /api/v1/search — public, no session (PRD §10). Thin per PRD §8.5:
// this suite only proves the route's own responsibilities (parse the
// query, call the service, wrap the result / map its errors) — the query
// schema itself is covered by tests/unit/lib/validation/search.test.ts and
// the translation/DTO-mapping logic by
// tests/unit/services/search/search-listings.test.ts.
describe('GET /api/v1/search', () => {
  beforeEach(() => {
    searchListings.execute.mockReset()
  })

  it('400s when channel is missing, without calling the service', async () => {
    const { GET } = await import('@/app/api/v1/search/route')

    const response = await GET(getRequest())

    expect(response.status).toBe(400)
    const body = await response.json()
    expect(body.error.code).toBe('invalid_request')
    expect(searchListings.execute).not.toHaveBeenCalled()
  })

  it('400s on an invalid combination (e.g. lat without lng)', async () => {
    const { GET } = await import('@/app/api/v1/search/route')

    const response = await GET(getRequest('?channel=sale&lat=51.4543'))

    expect(response.status).toBe(400)
    expect(searchListings.execute).not.toHaveBeenCalled()
  })

  it('calls the service with the parsed query and returns { data }', async () => {
    const result = {
      results: [],
      totalCount: 0,
      page: 1,
      totalPages: 0,
      facets: { propertyType: {} },
    }
    searchListings.execute.mockResolvedValue(result)
    const { GET } = await import('@/app/api/v1/search/route')

    const response = await GET(
      getRequest('?channel=sale&town=Reading&sort=price_asc'),
    )

    expect(searchListings.execute).toHaveBeenCalledWith(
      expect.objectContaining({
        channel: 'sale',
        town: 'Reading',
        sort: 'price_asc',
        page: 1,
      }),
    )
    expect(response.status).toBe(200)
    const body = await response.json()
    expect(body.data).toEqual(result)
  })

  it('maps SearchUnavailableError to 503 search_unavailable', async () => {
    searchListings.execute.mockRejectedValue(new SearchUnavailableError())
    const { GET } = await import('@/app/api/v1/search/route')

    const response = await GET(getRequest('?channel=sale'))

    expect(response.status).toBe(503)
    const body = await response.json()
    expect(body.error.code).toBe('search_unavailable')
  })

  it('maps an unexpected service error to 500', async () => {
    const consoleError = vi
      .spyOn(console, 'error')
      .mockImplementation(() => undefined)
    searchListings.execute.mockRejectedValue(new Error('boom'))
    const { GET } = await import('@/app/api/v1/search/route')

    const response = await GET(getRequest('?channel=sale'))

    expect(response.status).toBe(500)
    consoleError.mockRestore()
  })
})
