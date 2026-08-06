import { describe, expect, it } from 'vitest'

import { PostcodesIoGeocoder } from '@/adapters/postcodesio'

// Hits the real postcodes.io API (no key, no rate-limit concerns at this
// volume — PRD §11) to prove tests/unit/adapters/postcodesio/'s mocked
// fixtures actually match production response shapes. Gated on
// RUN_EXTERNAL_API_TESTS=1 rather than TEST_DATABASE_URL like every other
// file in this directory, since it needs network egress, not a database —
// run once locally to prove it (`RUN_EXTERNAL_API_TESTS=1 pnpm test`),
// skipped in CI (PRD §8.8's integration tier is "service containers", not
// third-party network calls).
describe.skipIf(process.env.RUN_EXTERNAL_API_TESTS !== '1')(
  'PostcodesIoGeocoder (live postcodes.io)',
  () => {
    it('resolves a real, known full postcode', async () => {
      const sut = new PostcodesIoGeocoder()

      const result = await sut.geocode('SW1A 1AA')

      expect(result).not.toBeNull()
      expect(result?.outcode).toBe('SW1A')
      expect(result?.lat).toBeCloseTo(51.501, 1)
      expect(result?.lng).toBeCloseTo(-0.1416, 1)
      expect(result?.label).toBeTruthy()
    })

    it('resolves a real outcode to its centroid', async () => {
      const sut = new PostcodesIoGeocoder()

      const result = await sut.geocode('RG30')

      expect(result).not.toBeNull()
      expect(result?.outcode).toBe('RG30')
      expect(result?.lat).toBeCloseTo(51.45, 1)
      expect(result?.lng).toBeCloseTo(-1.01, 1)
    })

    it('returns null for a well-formed but non-existent postcode', async () => {
      const sut = new PostcodesIoGeocoder()

      const result = await sut.geocode('ZZ99 9ZZ')

      expect(result).toBeNull()
    })

    it('returns null for free-text input, no request made', async () => {
      const sut = new PostcodesIoGeocoder()

      const result = await sut.geocode('Reading town centre')

      expect(result).toBeNull()
    })

    it('searchPlaces resolves real place suggestions from the Places API', async () => {
      const sut = new PostcodesIoGeocoder()

      const results = await sut.searchPlaces('Reading')

      expect(results.length).toBeGreaterThan(0)
      const reading = results.find((r) => r.name === 'Reading')
      expect(reading).toBeDefined()
      expect(reading?.lat).toBeCloseTo(51.45, 0)
      expect(reading?.lng).toBeCloseTo(-0.97, 0)
      expect(reading?.label).toContain('Reading')
    })

    it('searchPlaces returns an empty array for nonsense input', async () => {
      const sut = new PostcodesIoGeocoder()

      const results = await sut.searchPlaces('zzzxxxqqqasdkjhasdkjh')

      expect(results).toEqual([])
    })
  },
)
