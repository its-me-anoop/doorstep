import { describe, expect, it } from 'vitest'

import {
  decodeGeographyPoint,
  encodeGeographyPoint,
} from '@/adapters/drizzle/custom-types'

// These are pure encode/decode functions with no database dependency —
// PostGIS geography(Point,4326) columns exchange hex EWKB with
// text-protocol clients, so round-tripping through that format is what
// matters here. The DB-backed round trip (actually writing to and
// reading from Postgres) is covered by tests/integration/db.schema.test.ts,
// gated on TEST_DATABASE_URL because there is no live database on this
// machine.
describe('geography point EWKB encoding', () => {
  it('round-trips a UK point (Reading, RG1)', () => {
    const point = { lat: 51.4543, lng: -0.9781 }
    const hex = encodeGeographyPoint(point)
    expect(decodeGeographyPoint(hex)).toEqual(point)
  })

  it('round-trips (0, 0)', () => {
    const point = { lat: 0, lng: 0 }
    expect(decodeGeographyPoint(encodeGeographyPoint(point))).toEqual(point)
  })

  it('round-trips a negative-latitude point', () => {
    const point = { lat: -33.8688, lng: 151.2093 }
    expect(decodeGeographyPoint(encodeGeographyPoint(point))).toEqual(point)
  })

  it('produces the little-endian EWKB point-with-SRID header PostGIS expects', () => {
    const hex = encodeGeographyPoint({ lat: 51.5, lng: -0.1 })
    // byte 0: 01 (little-endian), bytes 1-4: 01000020 (wkbPoint | SRID flag,
    // little-endian uint32), bytes 5-8: E6100000 (SRID 4326, little-endian).
    expect(hex.slice(0, 18)).toBe('0101000020e6100000')
    expect(hex).toHaveLength(50)
  })
})
