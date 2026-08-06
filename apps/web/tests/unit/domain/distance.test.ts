import { describe, expect, it } from 'vitest'

import { milesToMetres } from '@/domain/distance'

// PRD §8.6: "radius search uses _geoRadius(lat, lng, metres)" — the public
// search API (GET /api/v1/search) takes radiusMiles from the caller, so
// this is the one place miles->metres conversion happens (services/search/
// search-listings.ts's translation step).
describe('milesToMetres', () => {
  it('converts using the exact international mile (1609.344m)', () => {
    expect(milesToMetres(1)).toBe(1609.344)
  })

  it('scales linearly', () => {
    expect(milesToMetres(2)).toBe(3218.688)
  })

  it('handles fractional miles', () => {
    expect(milesToMetres(0.25)).toBeCloseTo(402.336, 5)
  })

  it('handles zero', () => {
    expect(milesToMetres(0)).toBe(0)
  })
})
