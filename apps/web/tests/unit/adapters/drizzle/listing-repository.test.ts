import { describe, expect, it } from 'vitest'

import { mapRowToListing } from '@/adapters/drizzle/repositories/listing-repository'
import type { properties } from '@/adapters/drizzle/schema'

type PropertyRow = typeof properties.$inferSelect

// mapRowToListing is a pure function (row -> domain Listing), so it is
// unit-testable without a database connection. DrizzleListingRepository's
// query/transaction methods are exercised against a real Postgres+PostGIS
// instance in tests/integration/listing-repository.test.ts, gated on
// TEST_DATABASE_URL.
describe('mapRowToListing', () => {
  function row(overrides: Partial<PropertyRow> = {}): PropertyRow {
    return {
      id: '0190f4b0-0000-7000-8000-000000000001',
      listerId: '0190f4b0-0000-7000-8000-000000000010',
      agencyId: null,
      channel: 'sale',
      status: 'draft',
      propertyType: 'semi_detached',
      title: '3 bed semi-detached house for sale',
      slug: '3-bed-semi-detached-house-rg30-abc123',
      description: 'A lovely home.',
      features: ['Garden', 'Garage'],
      bedrooms: 3,
      bathrooms: 1,
      price: 250_000,
      priceQualifier: 'guide_price',
      tenure: 'freehold',
      deposit: null,
      furnished: null,
      availableFrom: null,
      epcRating: null,
      councilTaxBand: 'C',
      newHome: false,
      addressLine1: '1 Example Road',
      displayAddress: 'Example Road, Reading, RG30',
      town: 'Reading',
      outcode: 'RG30',
      postcode: 'RG30 1AA',
      location: { lat: 51.45, lng: -0.98 },
      locationApproximate: false,
      publishedAt: null,
      statusChangedAt: null,
      rejectionReason: null,
      createdAt: new Date('2026-01-01T00:00:00Z'),
      updatedAt: new Date('2026-01-02T00:00:00Z'),
      ...overrides,
    }
  }

  it('maps a properties row to the ListingRepository port shape', () => {
    const input = row()
    expect(mapRowToListing(input)).toEqual(input)
  })

  it('maps a null agencyId through unchanged (private owner listing)', () => {
    expect(mapRowToListing(row({ agencyId: null })).agencyId).toBeNull()
  })

  it('maps a non-null agencyId through unchanged (agent listing)', () => {
    expect(
      mapRowToListing(row({ agencyId: '0190f4b0-0000-7000-8000-000000000099' }))
        .agencyId,
    ).toBe('0190f4b0-0000-7000-8000-000000000099')
  })

  it('maps rent-only nullable fields through unchanged', () => {
    const input = row({
      channel: 'rent',
      tenure: null,
      deposit: 1200,
      furnished: 'furnished',
      availableFrom: new Date('2026-09-01T00:00:00Z'),
      epcRating: 'C',
    })
    const result = mapRowToListing(input)
    expect(result.deposit).toBe(1200)
    expect(result.furnished).toBe('furnished')
    expect(result.availableFrom).toEqual(new Date('2026-09-01T00:00:00Z'))
    expect(result.epcRating).toBe('C')
  })

  it('maps an empty features array through unchanged', () => {
    expect(mapRowToListing(row({ features: [] })).features).toEqual([])
  })

  it('maps publishedAt/statusChangedAt/rejectionReason through unchanged when set', () => {
    const input = row({
      status: 'rejected',
      publishedAt: null,
      statusChangedAt: new Date('2026-01-05T10:00:00Z'),
      rejectionReason: 'Poor quality photos',
    })
    const result = mapRowToListing(input)
    expect(result.publishedAt).toBeNull()
    expect(result.statusChangedAt).toEqual(new Date('2026-01-05T10:00:00Z'))
    expect(result.rejectionReason).toBe('Poor quality photos')
  })
})
