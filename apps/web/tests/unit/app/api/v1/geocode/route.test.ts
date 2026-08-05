import { NextRequest } from 'next/server'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const searchGeocode = { execute: vi.fn() }

vi.mock('@/lib/composition', () => ({
  createServices: () => ({
    geocoding: { searchGeocode },
  }),
}))

function getRequest(search = ''): NextRequest {
  return new NextRequest(`https://doorstep.test/api/v1/geocode${search}`)
}

// GET /api/v1/geocode — public, no session (PRD §10). M1 scope: the
// postcode fast path only (services/geocoding/search-geocode.ts) — this
// suite only proves the route's own responsibilities (parse `q`, call the
// service, wrap the result), not postcode recognition itself, which is
// covered where it actually lives: tests/unit/adapters/postcodesio/.
describe('GET /api/v1/geocode', () => {
  beforeEach(() => {
    searchGeocode.execute.mockReset()
  })

  it('400s with no q param, without calling the service', async () => {
    const { GET } = await import('@/app/api/v1/geocode/route')

    const response = await GET(getRequest())

    expect(response.status).toBe(400)
    const body = await response.json()
    expect(body.error.code).toBe('invalid_request')
    expect(searchGeocode.execute).not.toHaveBeenCalled()
  })

  it('400s with a blank q param', async () => {
    const { GET } = await import('@/app/api/v1/geocode/route')

    const response = await GET(getRequest('?q=%20%20'))

    expect(response.status).toBe(400)
    expect(searchGeocode.execute).not.toHaveBeenCalled()
  })

  it('returns {data: {results}} with a match', async () => {
    const result = {
      lat: 51.4543,
      lng: -0.9781,
      label: 'Reading',
      outcode: 'RG30',
    }
    searchGeocode.execute.mockResolvedValue([result])
    const { GET } = await import('@/app/api/v1/geocode/route')

    const response = await GET(getRequest('?q=RG30+1AA'))

    expect(searchGeocode.execute).toHaveBeenCalledWith('RG30 1AA')
    expect(response.status).toBe(200)
    const body = await response.json()
    expect(body.data.results).toEqual([result])
  })

  it('returns {data: {results: []}} for a query the fast path cannot resolve', async () => {
    searchGeocode.execute.mockResolvedValue([])
    const { GET } = await import('@/app/api/v1/geocode/route')

    const response = await GET(getRequest('?q=Reading+town+centre'))

    expect(response.status).toBe(200)
    const body = await response.json()
    expect(body.data.results).toEqual([])
  })

  it('maps an unexpected service error to 500', async () => {
    const consoleError = vi
      .spyOn(console, 'error')
      .mockImplementation(() => undefined)
    searchGeocode.execute.mockRejectedValue(new Error('boom'))
    const { GET } = await import('@/app/api/v1/geocode/route')

    const response = await GET(getRequest('?q=RG30'))

    expect(response.status).toBe(500)
    consoleError.mockRestore()
  })
})
