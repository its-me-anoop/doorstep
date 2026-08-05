import { describe, expect, it } from 'vitest'

import { mapRowToPropertyImage } from '@/adapters/drizzle/repositories/property-image-repository'
import type { propertyImages } from '@/adapters/drizzle/schema'

type PropertyImageRow = typeof propertyImages.$inferSelect

// mapRowToPropertyImage is a pure function (row -> domain PropertyImage),
// so it is unit-testable without a database connection.
// DrizzlePropertyImageRepository's query/mutation methods are exercised
// against a real Postgres instance in
// tests/integration/property-image-repository.test.ts, gated on
// TEST_DATABASE_URL — same split as mapRowToListing/mapRowToAgency.
describe('mapRowToPropertyImage', () => {
  function row(overrides: Partial<PropertyImageRow> = {}): PropertyImageRow {
    return {
      id: '0190f4b0-0000-7000-8000-000000000001',
      propertyId: '0190f4b0-0000-7000-8000-000000000010',
      kind: 'photo',
      storagePath: 'listings/prop-1/original/img-1',
      position: 0,
      width: 1600,
      height: 1200,
      blurhash: 'LGF5?xYk^6#M@-5c,1J5@[or[Q6.',
      altText: null,
      createdAt: new Date('2026-01-01T00:00:00Z'),
      updatedAt: new Date('2026-01-02T00:00:00Z'),
      ...overrides,
    }
  }

  it('maps a property_images row to the port shape', () => {
    const input = row()
    expect(mapRowToPropertyImage(input)).toEqual(input)
  })

  it('maps a null altText through unchanged', () => {
    expect(mapRowToPropertyImage(row({ altText: null })).altText).toBeNull()
  })

  it('maps a present altText through unchanged', () => {
    expect(
      mapRowToPropertyImage(row({ altText: 'Front of the house' })).altText,
    ).toBe('Front of the house')
  })

  it.each(['photo', 'floorplan', 'epc'] as const)(
    'maps kind %s through',
    (kind) => {
      expect(mapRowToPropertyImage(row({ kind })).kind).toBe(kind)
    },
  )
})
