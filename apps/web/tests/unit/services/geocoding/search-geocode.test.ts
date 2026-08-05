import { describe, expect, it } from 'vitest'

import { SearchGeocode } from '@/services/geocoding/search-geocode'

import { FakeGeocoder } from './fakes'

// GET /api/v1/geocode's use case (PRD §10, §8.6). Public — no actor, no
// authz — so unlike every services/listings/* test this file has no
// suspended-actor or ForbiddenError case; the only thing worth testing is
// the null -> [] wrapping SearchGeocode does around Geocoder's single
// result.
describe('SearchGeocode', () => {
  it('wraps a resolved geocode result in a single-element array', async () => {
    const geocoder = new FakeGeocoder()
    geocoder.setResult({
      lat: 51.4543,
      lng: -0.9781,
      label: 'Reading',
      outcode: 'RG30',
    })
    const sut = new SearchGeocode(geocoder)

    const results = await sut.execute('RG30 1AA')

    expect(results).toEqual([
      { lat: 51.4543, lng: -0.9781, label: 'Reading', outcode: 'RG30' },
    ])
  })

  it('returns an empty array when the geocoder cannot resolve the query', async () => {
    const geocoder = new FakeGeocoder()
    geocoder.setResult(null)
    const sut = new SearchGeocode(geocoder)

    const results = await sut.execute('Reading town centre')

    expect(results).toEqual([])
  })

  it('passes the query through to the geocoder unchanged', async () => {
    const geocoder = new FakeGeocoder()
    const sut = new SearchGeocode(geocoder)

    await sut.execute('  RG30 1AA  ')

    expect(geocoder.lastQuery).toBe('  RG30 1AA  ')
  })
})
