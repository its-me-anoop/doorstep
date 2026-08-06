import { describe, expect, it } from 'vitest'

import { MapboxGeocoder } from '@/adapters/mapbox'

// Hits the real Mapbox Geocoding API — needs a real MAPBOX_ACCESS_TOKEN
// (PRD §8.6, §10 SRCH-1; see .env.example). No token is available in this
// project's local or CI environments today (adapters/mapbox/'s own doc
// comment records the resulting deviation: postcodes.io's Places API is
// the actual default until one is provisioned), so this suite is expected
// to skip everywhere until that changes — tests/unit/adapters/mapbox/
// mapbox-geocoder.test.ts (mocked fetch) is what actually proves this
// adapter's request-building and response-mapping logic today.
describe.skipIf(!process.env.MAPBOX_ACCESS_TOKEN)(
  'MapboxGeocoder (live Mapbox API)',
  () => {
    it('resolves a real place via geocode', async () => {
      const sut = new MapboxGeocoder()

      const result = await sut.geocode('Reading, Berkshire')

      expect(result).not.toBeNull()
      expect(result?.lat).toBeCloseTo(51.45, 0)
      expect(result?.lng).toBeCloseTo(-0.97, 0)
    })

    it('returns several suggestions via searchPlaces', async () => {
      const sut = new MapboxGeocoder()

      const results = await sut.searchPlaces('Readi')

      expect(results.length).toBeGreaterThan(0)
    })
  },
)
