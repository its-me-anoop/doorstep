import { describe, expect, it } from 'vitest'

import { InMemoryTtlGeocodeCache } from '@/adapters/in-memory-geocode-cache'
import type { GeocodeResult, PlaceSuggestion } from '@/ports/geocoder'

import { FakeClock } from '../services/auth/fakes'

const RESULT: GeocodeResult = {
  lat: 51.4543,
  lng: -0.9781,
  label: 'Reading',
  outcode: 'RG30',
}

const PLACES: PlaceSuggestion[] = [
  {
    name: 'Reading',
    label: 'Reading, Berkshire',
    lat: 51.4543,
    lng: -0.9781,
    outcode: 'RG1',
  },
]

const THIRTY_DAYS_MS = 30 * 24 * 60 * 60 * 1000

describe('InMemoryTtlGeocodeCache', () => {
  describe('postcode lookups', () => {
    it('is a miss (undefined) before anything is cached', async () => {
      const clock = new FakeClock(new Date('2026-01-01T00:00:00Z'))
      const cache = new InMemoryTtlGeocodeCache(clock)

      expect(await cache.getPostcode('RG30 1AA')).toBeUndefined()
    })

    it('returns whatever was cached, including a positive result', async () => {
      const clock = new FakeClock(new Date('2026-01-01T00:00:00Z'))
      const cache = new InMemoryTtlGeocodeCache(clock)

      await cache.setPostcode('RG30 1AA', RESULT)

      expect(await cache.getPostcode('RG30 1AA')).toEqual(RESULT)
    })

    it('caches a negative result (null) as a real hit, not a miss', async () => {
      const clock = new FakeClock(new Date('2026-01-01T00:00:00Z'))
      const cache = new InMemoryTtlGeocodeCache(clock)

      await cache.setPostcode('nonsense', null)

      expect(await cache.getPostcode('nonsense')).toBeNull()
    })

    it('expires after 30 days', async () => {
      const clock = new FakeClock(new Date('2026-01-01T00:00:00Z'))
      const cache = new InMemoryTtlGeocodeCache(clock)
      await cache.setPostcode('RG30 1AA', RESULT)

      clock.advanceBy(THIRTY_DAYS_MS + 1)

      expect(await cache.getPostcode('RG30 1AA')).toBeUndefined()
    })

    it('is still a hit just under 30 days', async () => {
      const clock = new FakeClock(new Date('2026-01-01T00:00:00Z'))
      const cache = new InMemoryTtlGeocodeCache(clock)
      await cache.setPostcode('RG30 1AA', RESULT)

      clock.advanceBy(THIRTY_DAYS_MS - 1)

      expect(await cache.getPostcode('RG30 1AA')).toEqual(RESULT)
    })
  })

  describe('place lookups', () => {
    it('is a miss (undefined) before anything is cached', async () => {
      const clock = new FakeClock(new Date('2026-01-01T00:00:00Z'))
      const cache = new InMemoryTtlGeocodeCache(clock)

      expect(await cache.getPlaces('Reading')).toBeUndefined()
    })

    it('returns whatever was cached, including an empty array', async () => {
      const clock = new FakeClock(new Date('2026-01-01T00:00:00Z'))
      const cache = new InMemoryTtlGeocodeCache(clock)

      await cache.setPlaces('nowhere', [])

      expect(await cache.getPlaces('nowhere')).toEqual([])
    })

    it('returns cached suggestions', async () => {
      const clock = new FakeClock(new Date('2026-01-01T00:00:00Z'))
      const cache = new InMemoryTtlGeocodeCache(clock)

      await cache.setPlaces('Reading', PLACES)

      expect(await cache.getPlaces('Reading')).toEqual(PLACES)
    })

    it('expires after 30 days', async () => {
      const clock = new FakeClock(new Date('2026-01-01T00:00:00Z'))
      const cache = new InMemoryTtlGeocodeCache(clock)
      await cache.setPlaces('Reading', PLACES)

      clock.advanceBy(THIRTY_DAYS_MS + 1)

      expect(await cache.getPlaces('Reading')).toBeUndefined()
    })
  })

  it('keeps the postcode and places caches independent — same key, different namespaces', async () => {
    const clock = new FakeClock(new Date('2026-01-01T00:00:00Z'))
    const cache = new InMemoryTtlGeocodeCache(clock)

    await cache.setPostcode('reading', RESULT)

    expect(await cache.getPlaces('reading')).toBeUndefined()
  })
})
