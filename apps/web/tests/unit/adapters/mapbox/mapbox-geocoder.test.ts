import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { MapboxGeocoder, resolveMapboxAccessToken } from '@/adapters/mapbox'

// MapboxGeocoder implements Geocoder (ports/geocoder.ts) against Mapbox's
// v5 forward-geocoding endpoint, GB-biased (PRD §8.6, §10 SRCH-1). Every
// case here mocks global fetch — no live token or network call. The real
// API is exercised (when a token is available) by
// tests/integration/mapbox-geocoder.test.ts.
describe('MapboxGeocoder', () => {
  let fetchMock: ReturnType<typeof vi.fn>

  beforeEach(() => {
    fetchMock = vi.fn()
    vi.stubGlobal('fetch', fetchMock)
  })

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  function jsonResponse(status: number, body: unknown): Response {
    return new Response(JSON.stringify(body), { status })
  }

  const FEATURE = {
    place_name: 'Reading, Berkshire, England, United Kingdom',
    text: 'Reading',
    center: [-0.9781, 51.4543],
  }

  describe('resolveMapboxAccessToken', () => {
    it('reads MAPBOX_ACCESS_TOKEN', () => {
      expect(resolveMapboxAccessToken({ MAPBOX_ACCESS_TOKEN: 'pk.test' })).toBe(
        'pk.test',
      )
    })

    it('throws a descriptive error when unset', () => {
      expect(() => resolveMapboxAccessToken({})).toThrow(/MAPBOX_ACCESS_TOKEN/)
    })
  })

  describe('geocode', () => {
    it('requests the v5 forward-geocoding endpoint with GB bias', async () => {
      fetchMock.mockResolvedValue(jsonResponse(200, { features: [FEATURE] }))
      const sut = new MapboxGeocoder({ MAPBOX_ACCESS_TOKEN: 'pk.test' })

      await sut.geocode('Reading')

      const [url] = fetchMock.mock.calls[0] as [string]
      expect(url).toContain(
        'https://api.mapbox.com/geocoding/v5/mapbox.places/Reading.json',
      )
      expect(url).toContain('country=gb')
      expect(url).toContain('access_token=pk.test')
    })

    it('maps the top feature to a GeocodeResult', async () => {
      fetchMock.mockResolvedValue(jsonResponse(200, { features: [FEATURE] }))
      const sut = new MapboxGeocoder({ MAPBOX_ACCESS_TOKEN: 'pk.test' })

      const result = await sut.geocode('Reading')

      expect(result).toEqual({
        lat: 51.4543,
        lng: -0.9781,
        label: 'Reading, Berkshire, England, United Kingdom',
        outcode: null,
      })
    })

    it('returns null when there are no features', async () => {
      fetchMock.mockResolvedValue(jsonResponse(200, { features: [] }))
      const sut = new MapboxGeocoder({ MAPBOX_ACCESS_TOKEN: 'pk.test' })

      const result = await sut.geocode('asdkjhasdkjh')

      expect(result).toBeNull()
    })

    it('returns null on a non-ok response rather than throwing', async () => {
      fetchMock.mockResolvedValue(jsonResponse(500, {}))
      const sut = new MapboxGeocoder({ MAPBOX_ACCESS_TOKEN: 'pk.test' })

      const result = await sut.geocode('Reading')

      expect(result).toBeNull()
    })

    it('throws when MAPBOX_ACCESS_TOKEN is unset', async () => {
      const sut = new MapboxGeocoder({})

      await expect(sut.geocode('Reading')).rejects.toThrow(
        /MAPBOX_ACCESS_TOKEN/,
      )
      expect(fetchMock).not.toHaveBeenCalled()
    })
  })

  describe('searchPlaces', () => {
    it('requests the same endpoint with autocomplete enabled', async () => {
      fetchMock.mockResolvedValue(jsonResponse(200, { features: [FEATURE] }))
      const sut = new MapboxGeocoder({ MAPBOX_ACCESS_TOKEN: 'pk.test' })

      await sut.searchPlaces('Read')

      const [url] = fetchMock.mock.calls[0] as [string]
      expect(url).toContain('autocomplete=true')
      expect(url).toContain('country=gb')
    })

    it('maps every feature to a PlaceSuggestion', async () => {
      fetchMock.mockResolvedValue(
        jsonResponse(200, {
          features: [
            FEATURE,
            {
              place_name: 'Reading Bridge, Reading, England, United Kingdom',
              text: 'Reading Bridge',
              center: [-0.9689, 51.4617],
            },
          ],
        }),
      )
      const sut = new MapboxGeocoder({ MAPBOX_ACCESS_TOKEN: 'pk.test' })

      const results = await sut.searchPlaces('Read')

      expect(results).toEqual([
        {
          name: 'Reading',
          label: 'Reading, Berkshire, England, United Kingdom',
          lat: 51.4543,
          lng: -0.9781,
          outcode: null,
        },
        {
          name: 'Reading Bridge',
          label: 'Reading Bridge, Reading, England, United Kingdom',
          lat: 51.4617,
          lng: -0.9689,
          outcode: null,
        },
      ])
    })

    it('returns an empty array on a non-ok response rather than throwing', async () => {
      fetchMock.mockResolvedValue(jsonResponse(500, {}))
      const sut = new MapboxGeocoder({ MAPBOX_ACCESS_TOKEN: 'pk.test' })

      const results = await sut.searchPlaces('Reading')

      expect(results).toEqual([])
    })

    it('throws when MAPBOX_ACCESS_TOKEN is unset', async () => {
      const sut = new MapboxGeocoder({})

      await expect(sut.searchPlaces('Reading')).rejects.toThrow(
        /MAPBOX_ACCESS_TOKEN/,
      )
    })
  })
})
