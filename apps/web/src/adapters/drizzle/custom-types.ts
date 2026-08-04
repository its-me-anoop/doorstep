/**
 * Postgres column types Drizzle doesn't ship natively: PostGIS
 * `geography(Point,4326)` and citext. See PRD §9.2.
 *
 * The geography point is encoded/decoded as hex EWKB (little-endian, with
 * the SRID flag set) — the format PostGIS's `geography_in`/`geography_out`
 * accept and produce for text-protocol clients such as postgres.js. This
 * keeps the customType free of any dependency on a running Postgres
 * connection, so the encode/decode pair is unit-testable without a
 * database (there is no live database on this machine — see the
 * integration test for the DB-backed round trip, gated on
 * TEST_DATABASE_URL).
 */

import { customType } from 'drizzle-orm/pg-core'

import type { GeoPoint } from '@/domain/property'

const WGS84_SRID = 4326
/** wkbPoint (1) with the EWKB SRID flag (0x20000000) set. */
const EWKB_POINT_WITH_SRID = 0x20000001
const EWKB_POINT_BYTE_LENGTH = 25

export function encodeGeographyPoint(point: GeoPoint): string {
  const buffer = Buffer.alloc(EWKB_POINT_BYTE_LENGTH)
  buffer.writeUInt8(1, 0) // byte order: little-endian
  buffer.writeUInt32LE(EWKB_POINT_WITH_SRID, 1)
  buffer.writeUInt32LE(WGS84_SRID, 5)
  buffer.writeDoubleLE(point.lng, 9)
  buffer.writeDoubleLE(point.lat, 17)
  return buffer.toString('hex')
}

export function decodeGeographyPoint(hex: string): GeoPoint {
  const buffer = Buffer.from(hex, 'hex')
  return {
    lng: buffer.readDoubleLE(9),
    lat: buffer.readDoubleLE(17),
  }
}

export const geographyPoint = customType<{
  data: GeoPoint
  driverData: string
}>({
  dataType() {
    return 'geography(Point,4326)'
  },
  toDriver(value) {
    return encodeGeographyPoint(value)
  },
  fromDriver(value) {
    return decodeGeographyPoint(value)
  },
})

export const citext = customType<{ data: string }>({
  dataType() {
    return 'citext'
  },
})
