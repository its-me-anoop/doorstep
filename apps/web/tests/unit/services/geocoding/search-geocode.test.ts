import { describe, expect, it } from 'vitest'

import { SearchGeocode } from '@/services/geocoding/search-geocode'

import {
  FakeGeocodeCache,
  FakePlaceSearcher,
  FakePostcodeGeocoder,
} from './fakes'

// GET /api/v1/geocode's use case (PRD §10 SRCH-1, §8.6). Public — no
// actor, no authz. "postcode fast-path hits first, else places" (PRD
// §10): a resolvable postcode/outcode short-circuits straight to a single
// postcode suggestion; anything else falls through to the place searcher.
// Both halves are cached (GeocodeCache, 30 days — PRD §8.6).
describe('SearchGeocode', () => {
  function setup() {
    const postcodeGeocoder = new FakePostcodeGeocoder()
    const placeSearcher = new FakePlaceSearcher()
    const cache = new FakeGeocodeCache()
    const sut = new SearchGeocode(postcodeGeocoder, placeSearcher, cache)
    return { postcodeGeocoder, placeSearcher, cache, sut }
  }

  it('returns a single postcode suggestion when the fast path resolves', async () => {
    const { postcodeGeocoder, placeSearcher, sut } = setup()
    postcodeGeocoder.setResult({
      lat: 51.4543,
      lng: -0.9781,
      label: 'Reading',
      outcode: 'RG30',
    })

    const results = await sut.execute('RG30 1AA')

    expect(results).toEqual([
      {
        kind: 'postcode',
        lat: 51.4543,
        lng: -0.9781,
        label: 'Reading',
        outcode: 'RG30',
      },
    ])
    expect(placeSearcher.callCount).toBe(0)
  })

  it('falls through to place suggestions when the postcode fast path misses', async () => {
    const { postcodeGeocoder, placeSearcher, sut } = setup()
    postcodeGeocoder.setResult(null)
    placeSearcher.setResults([
      {
        name: 'Reading',
        label: 'Reading, Berkshire, England',
        lat: 51.4543,
        lng: -0.9781,
        outcode: null,
      },
    ])

    const results = await sut.execute('Reading town centre')

    expect(results).toEqual([
      {
        kind: 'place',
        name: 'Reading',
        label: 'Reading, Berkshire, England',
        lat: 51.4543,
        lng: -0.9781,
        outcode: null,
      },
    ])
  })

  it('returns an empty array when neither the postcode nor the place path resolves', async () => {
    const { postcodeGeocoder, placeSearcher, sut } = setup()
    postcodeGeocoder.setResult(null)
    placeSearcher.setResults([])

    const results = await sut.execute('asdkjhasdkjh')

    expect(results).toEqual([])
  })

  it('passes the query through to the postcode geocoder unchanged', async () => {
    const { postcodeGeocoder, sut } = setup()

    await sut.execute('  RG30 1AA  ')

    expect(postcodeGeocoder.lastQuery).toBe('  RG30 1AA  ')
  })

  it('passes the query through to the place searcher unchanged', async () => {
    const { placeSearcher, sut } = setup()

    await sut.execute('Reading town centre')

    expect(placeSearcher.lastQuery).toBe('Reading town centre')
  })

  describe('caching', () => {
    it('caches a postcode hit — a repeat query does not call the geocoder again', async () => {
      const { postcodeGeocoder, sut } = setup()
      postcodeGeocoder.setResult({
        lat: 51.4543,
        lng: -0.9781,
        label: 'Reading',
        outcode: 'RG30',
      })

      await sut.execute('RG30 1AA')
      const results = await sut.execute('RG30 1AA')

      expect(postcodeGeocoder.callCount).toBe(1)
      expect(results[0]).toMatchObject({ kind: 'postcode', label: 'Reading' })
    })

    it('caches a postcode miss (null) — a repeat query does not call the geocoder again', async () => {
      const { postcodeGeocoder, sut } = setup()
      postcodeGeocoder.setResult(null)

      await sut.execute('Reading town centre')
      await sut.execute('Reading town centre')

      expect(postcodeGeocoder.callCount).toBe(1)
    })

    it('caches place results — a repeat query does not call the place searcher again', async () => {
      const { postcodeGeocoder, placeSearcher, sut } = setup()
      postcodeGeocoder.setResult(null)
      placeSearcher.setResults([
        {
          name: 'Reading',
          label: 'Reading',
          lat: 51.4543,
          lng: -0.9781,
          outcode: null,
        },
      ])

      await sut.execute('Reading')
      await sut.execute('Reading')

      expect(placeSearcher.callCount).toBe(1)
    })

    it('is case- and whitespace-insensitive for the cache key', async () => {
      const { postcodeGeocoder, sut } = setup()
      postcodeGeocoder.setResult({
        lat: 51.4543,
        lng: -0.9781,
        label: 'Reading',
        outcode: 'RG30',
      })

      await sut.execute('RG30 1AA')
      await sut.execute('  rg30 1aa  ')

      expect(postcodeGeocoder.callCount).toBe(1)
    })
  })
})
