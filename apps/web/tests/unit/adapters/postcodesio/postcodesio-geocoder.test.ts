import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { PostcodesIoGeocoder } from '@/adapters/postcodesio'

// PostcodesIoGeocoder implements Geocoder (ports/geocoder.ts) against
// postcodes.io's real response shapes (verified by hand against the live
// API — see tests/integration/postcodesio-geocoder.test.ts). Every case
// here mocks global fetch, so no network call is ever made in this file.
describe('PostcodesIoGeocoder', () => {
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

  it('resolves a full postcode via GET /postcodes/{postcode}', async () => {
    fetchMock.mockResolvedValue(
      jsonResponse(200, {
        status: 200,
        result: {
          postcode: 'SW1A 1AA',
          longitude: -0.141563,
          latitude: 51.50101,
          outcode: 'SW1A',
          admin_district: 'Westminster',
          parish: 'Westminster, unparished area',
        },
      }),
    )
    const sut = new PostcodesIoGeocoder()

    const result = await sut.geocode('SW1A 1AA')

    expect(result).toEqual({
      lat: 51.50101,
      lng: -0.141563,
      label: 'Westminster',
      outcode: 'SW1A',
    })
    expect(fetchMock).toHaveBeenCalledWith(
      'https://api.postcodes.io/postcodes/SW1A%201AA',
    )
  })

  it('normalises a lowercase, unspaced postcode before calling the API', async () => {
    fetchMock.mockResolvedValue(
      jsonResponse(200, {
        status: 200,
        result: {
          postcode: 'RG30 1AA',
          longitude: -0.9781,
          latitude: 51.4543,
          outcode: 'RG30',
          admin_district: 'Reading',
          parish: null,
        },
      }),
    )
    const sut = new PostcodesIoGeocoder()

    await sut.geocode('rg301aa')

    expect(fetchMock).toHaveBeenCalledWith(
      'https://api.postcodes.io/postcodes/RG30%201AA',
    )
  })

  it('falls back to parish when admin_district is null', async () => {
    fetchMock.mockResolvedValue(
      jsonResponse(200, {
        status: 200,
        result: {
          postcode: 'RG30 1AA',
          longitude: -0.9781,
          latitude: 51.4543,
          outcode: 'RG30',
          admin_district: null,
          parish: 'Tilehurst',
        },
      }),
    )
    const sut = new PostcodesIoGeocoder()

    const result = await sut.geocode('RG30 1AA')

    expect(result?.label).toBe('Tilehurst')
  })

  it('returns null for a well-formed but unknown postcode (404)', async () => {
    fetchMock.mockResolvedValue(
      jsonResponse(404, { status: 404, error: 'Postcode not found' }),
    )
    const sut = new PostcodesIoGeocoder()

    const result = await sut.geocode('ZZ9 9ZZ')

    expect(result).toBeNull()
  })

  it('resolves a partial postcode (outcode only) via GET /outcodes/{outcode}', async () => {
    fetchMock.mockResolvedValue(
      jsonResponse(200, {
        status: 200,
        result: {
          outcode: 'RG30',
          longitude: -1.0148052755417944,
          latitude: 51.451065061919515,
          admin_district: ['Reading', 'West Berkshire'],
        },
      }),
    )
    const sut = new PostcodesIoGeocoder()

    const result = await sut.geocode('RG30')

    expect(result).toEqual({
      lat: 51.451065061919515,
      lng: -1.0148052755417944,
      label: 'Reading',
      outcode: 'RG30',
    })
    expect(fetchMock).toHaveBeenCalledWith(
      'https://api.postcodes.io/outcodes/RG30',
    )
  })

  it('returns null for a well-formed but unknown outcode (404)', async () => {
    fetchMock.mockResolvedValue(
      jsonResponse(404, { status: 404, error: 'Outcode not found' }),
    )
    const sut = new PostcodesIoGeocoder()

    const result = await sut.geocode('ZZ99')

    expect(result).toBeNull()
  })

  it('returns null for free-text input without calling postcodes.io (Mapbox lands in M2)', async () => {
    const sut = new PostcodesIoGeocoder()

    const result = await sut.geocode('Reading town centre')

    expect(result).toBeNull()
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it('returns null for an empty query without calling postcodes.io', async () => {
    const sut = new PostcodesIoGeocoder()

    const result = await sut.geocode('   ')

    expect(result).toBeNull()
    expect(fetchMock).not.toHaveBeenCalled()
  })

  describe('searchPlaces', () => {
    it('maps GET /places results to PlaceSuggestion[]', async () => {
      fetchMock.mockResolvedValue(
        jsonResponse(200, {
          status: 200,
          result: [
            {
              name_1: 'Reading',
              county_unitary: 'Reading',
              district_borough: null,
              region: 'South East',
              country: 'England',
              local_type: 'Town',
              latitude: 51.4543,
              longitude: -0.9781,
            },
          ],
        }),
      )
      const sut = new PostcodesIoGeocoder()

      const results = await sut.searchPlaces('Reading')

      expect(results).toEqual([
        {
          name: 'Reading',
          label: 'Reading, South East, England',
          lat: 51.4543,
          lng: -0.9781,
          outcode: null,
        },
      ])
      expect(fetchMock).toHaveBeenCalledWith(
        'https://api.postcodes.io/places?q=Reading',
      )
    })

    it('does not repeat name_1 in the label when it duplicates county_unitary', async () => {
      fetchMock.mockResolvedValue(
        jsonResponse(200, {
          status: 200,
          result: [
            {
              name_1: 'Caversham',
              county_unitary: null,
              district_borough: 'Reading',
              region: 'South East',
              country: 'England',
              local_type: 'Suburban Area',
              latitude: 51.465,
              longitude: -0.9723,
            },
          ],
        }),
      )
      const sut = new PostcodesIoGeocoder()

      const results = await sut.searchPlaces('Caversham')

      expect(results[0]?.label).toBe('Caversham, Reading, South East, England')
    })

    it('URL-encodes the query', async () => {
      fetchMock.mockResolvedValue(
        jsonResponse(200, { status: 200, result: [] }),
      )
      const sut = new PostcodesIoGeocoder()

      await sut.searchPlaces('St Mary Bourne')

      expect(fetchMock).toHaveBeenCalledWith(
        'https://api.postcodes.io/places?q=St%20Mary%20Bourne',
      )
    })

    it('returns an empty array when the API reports no matches', async () => {
      fetchMock.mockResolvedValue(
        jsonResponse(200, { status: 200, result: null }),
      )
      const sut = new PostcodesIoGeocoder()

      const results = await sut.searchPlaces('asdkjhasdkjh')

      expect(results).toEqual([])
    })

    it('returns an empty array on a non-ok response rather than throwing', async () => {
      fetchMock.mockResolvedValue(jsonResponse(500, { status: 500 }))
      const sut = new PostcodesIoGeocoder()

      const results = await sut.searchPlaces('Reading')

      expect(results).toEqual([])
    })

    it('returns an empty array for a blank query without calling the API', async () => {
      const sut = new PostcodesIoGeocoder()

      const results = await sut.searchPlaces('   ')

      expect(results).toEqual([])
      expect(fetchMock).not.toHaveBeenCalled()
    })
  })
})
