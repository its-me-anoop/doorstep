import { describe, expect, it } from 'vitest'

import {
  changeListingStatusSchema,
  draftListingSchema,
  submitListingSchema,
} from '@/lib/validation/listing'

function issuePaths(result: {
  success: boolean
  error?: { issues: { path: PropertyKey[] }[] }
}) {
  return result.error?.issues.map((issue) => issue.path.join('.')) ?? []
}

// PRD §6.5 LST-2 — "a draft can be saved at any step and resumed": the
// draft schema only ever requires the two fields the wizard's first step
// collects (channel, property type); everything else is optional so a
// half-filled wizard can still be persisted.
describe('draftListingSchema', () => {
  it('accepts just channel and propertyType', () => {
    const result = draftListingSchema.safeParse({
      channel: 'sale',
      propertyType: 'flat',
    })
    expect(result.success).toBe(true)
  })

  it('rejects a missing channel', () => {
    const result = draftListingSchema.safeParse({ propertyType: 'flat' })
    expect(result.success).toBe(false)
  })

  it('rejects a missing propertyType', () => {
    const result = draftListingSchema.safeParse({ channel: 'sale' })
    expect(result.success).toBe(false)
  })

  it('rejects an invalid channel', () => {
    const result = draftListingSchema.safeParse({
      channel: 'lease',
      propertyType: 'flat',
    })
    expect(result.success).toBe(false)
  })

  it('accepts a fully-populated sale draft', () => {
    const result = draftListingSchema.safeParse({
      channel: 'sale',
      propertyType: 'semi_detached',
      title: '3 bed semi-detached house for sale',
      description: 'A lovely home.',
      features: ['Garden', 'Garage'],
      bedrooms: 3,
      bathrooms: 1,
      price: 250_000,
      priceQualifier: 'guide_price',
      tenure: 'freehold',
      addressLine1: '1 Example Road',
      displayAddress: 'Example Road, Reading, RG30',
      town: 'Reading',
      outcode: 'RG30',
      postcode: 'RG30 1AA',
      location: { lat: 51.45, lng: -0.98 },
      locationApproximate: false,
    })
    expect(result.success).toBe(true)
  })

  it('accepts a fully-populated rent draft', () => {
    const result = draftListingSchema.safeParse({
      channel: 'rent',
      propertyType: 'flat',
      furnished: 'furnished',
      availableFrom: '2026-09-01',
      deposit: 1200,
      epcRating: 'C',
    })
    expect(result.success).toBe(true)
  })

  it('still enforces the sale price range when a price is present', () => {
    const result = draftListingSchema.safeParse({
      channel: 'sale',
      propertyType: 'flat',
      price: 500,
    })
    expect(result.success).toBe(false)
    expect(issuePaths(result)).toContain('price')
  })

  it('still enforces the rent price range when a price is present', () => {
    const result = draftListingSchema.safeParse({
      channel: 'rent',
      propertyType: 'flat',
      price: 1,
    })
    expect(result.success).toBe(false)
    expect(issuePaths(result)).toContain('price')
  })

  it('accepts a sale price at the lower boundary (1000)', () => {
    const result = draftListingSchema.safeParse({
      channel: 'sale',
      propertyType: 'flat',
      price: 1000,
    })
    expect(result.success).toBe(true)
  })

  it('accepts a sale price at the upper boundary (100,000,000)', () => {
    const result = draftListingSchema.safeParse({
      channel: 'sale',
      propertyType: 'flat',
      price: 100_000_000,
    })
    expect(result.success).toBe(true)
  })

  it('rejects a sale price one pound over the upper boundary', () => {
    const result = draftListingSchema.safeParse({
      channel: 'sale',
      propertyType: 'flat',
      price: 100_000_001,
    })
    expect(result.success).toBe(false)
  })

  it('accepts a rent price at the lower boundary (50)', () => {
    const result = draftListingSchema.safeParse({
      channel: 'rent',
      propertyType: 'flat',
      price: 50,
    })
    expect(result.success).toBe(true)
  })

  it('accepts a rent price at the upper boundary (100,000)', () => {
    const result = draftListingSchema.safeParse({
      channel: 'rent',
      propertyType: 'flat',
      price: 100_000,
    })
    expect(result.success).toBe(true)
  })

  it('rejects a non-integer price', () => {
    const result = draftListingSchema.safeParse({
      channel: 'sale',
      propertyType: 'flat',
      price: 100_000.5,
    })
    expect(result.success).toBe(false)
  })

  it('rejects more than 10 features', () => {
    const result = draftListingSchema.safeParse({
      channel: 'sale',
      propertyType: 'flat',
      features: Array.from({ length: 11 }, (_, i) => `Feature ${i}`),
    })
    expect(result.success).toBe(false)
  })

  it('accepts exactly 10 features', () => {
    const result = draftListingSchema.safeParse({
      channel: 'sale',
      propertyType: 'flat',
      features: Array.from({ length: 10 }, (_, i) => `Feature ${i}`),
    })
    expect(result.success).toBe(true)
  })

  it('does not require tenure for a sale draft', () => {
    const result = draftListingSchema.safeParse({
      channel: 'sale',
      propertyType: 'flat',
    })
    expect(result.success).toBe(true)
  })

  it('does not require epcRating for a rent draft', () => {
    const result = draftListingSchema.safeParse({
      channel: 'rent',
      propertyType: 'flat',
    })
    expect(result.success).toBe(true)
  })
})

// PRD §9.2's completeness bar for pending_review — the strict schema
// SubmitListing validates against the stored listing before allowing the
// draft -> pending_review transition (services/listings/submit-listing.ts).
describe('submitListingSchema', () => {
  const validSale = {
    channel: 'sale' as const,
    propertyType: 'semi_detached' as const,
    title: '3 bed semi-detached house for sale',
    description: 'A lovely home.',
    features: ['Garden'],
    bedrooms: 3,
    bathrooms: 1,
    price: 250_000,
    priceQualifier: 'guide_price' as const,
    tenure: 'freehold' as const,
    addressLine1: '1 Example Road',
    displayAddress: 'Example Road, Reading, RG30',
    town: 'Reading',
    outcode: 'RG30',
    postcode: 'RG30 1AA',
    location: { lat: 51.45, lng: -0.98 },
  }

  const validRent = {
    channel: 'rent' as const,
    propertyType: 'flat' as const,
    title: '2 bed flat to rent',
    description: 'A lovely flat.',
    features: [] as string[],
    bedrooms: 2,
    bathrooms: 1,
    price: 1500,
    priceQualifier: 'fixed' as const,
    epcRating: 'C' as const,
    addressLine1: '2 Example Road',
    displayAddress: 'Example Road, Reading, RG1',
    town: 'Reading',
    outcode: 'RG1',
    postcode: 'RG1 1AA',
    location: { lat: 51.45, lng: -0.97 },
  }

  it('accepts a fully complete sale listing', () => {
    expect(submitListingSchema.safeParse(validSale).success).toBe(true)
  })

  it('accepts a fully complete rent listing', () => {
    expect(submitListingSchema.safeParse(validRent).success).toBe(true)
  })

  it.each([
    'title',
    'description',
    'bedrooms',
    'bathrooms',
    'price',
    'priceQualifier',
    'displayAddress',
    'addressLine1',
    'town',
    'outcode',
    'postcode',
    'location',
  ])('rejects a sale submission missing %s', (field) => {
    const input: Record<string, unknown> = { ...validSale }
    delete input[field]
    const result = submitListingSchema.safeParse(input)
    expect(result.success).toBe(false)
  })

  it('requires tenure for a sale submission', () => {
    const result = submitListingSchema.safeParse({
      ...validSale,
      tenure: undefined,
    })
    expect(result.success).toBe(false)
    expect(issuePaths(result)).toContain('tenure')
  })

  it('does not require furnished, availableFrom or deposit for a rent submission', () => {
    const result = submitListingSchema.safeParse(validRent)
    expect(result.success).toBe(true)
  })

  it('requires epcRating for a rent submission', () => {
    const withoutEpc: Record<string, unknown> = { ...validRent }
    delete withoutEpc.epcRating
    const result = submitListingSchema.safeParse(withoutEpc)
    expect(result.success).toBe(false)
    expect(issuePaths(result)).toContain('epcRating')
  })

  it('rejects a null epcRating for a rent submission (present but empty)', () => {
    const result = submitListingSchema.safeParse({
      ...validRent,
      epcRating: null,
    })
    expect(result.success).toBe(false)
    expect(issuePaths(result)).toContain('epcRating')
  })

  it('does not require tenure for a rent submission', () => {
    const result = submitListingSchema.safeParse(validRent)
    expect(result.success).toBe(true)
    if (result.success) {
      expect(result.data.tenure ?? null).toBeNull()
    }
  })

  it('does not require epcRating for a sale submission', () => {
    const result = submitListingSchema.safeParse(validSale)
    expect(result.success).toBe(true)
  })

  it('enforces the sale price range', () => {
    const result = submitListingSchema.safeParse({ ...validSale, price: 999 })
    expect(result.success).toBe(false)
    expect(issuePaths(result)).toContain('price')
  })

  it('enforces the rent price range', () => {
    const result = submitListingSchema.safeParse({ ...validRent, price: 49 })
    expect(result.success).toBe(false)
    expect(issuePaths(result)).toContain('price')
  })

  it('rejects more than 10 features', () => {
    const result = submitListingSchema.safeParse({
      ...validSale,
      features: Array.from({ length: 11 }, (_, i) => `Feature ${i}`),
    })
    expect(result.success).toBe(false)
  })

  it('reports both a missing title and a missing price together', () => {
    const input: Record<string, unknown> = { ...validSale }
    delete input.title
    delete input.price
    const result = submitListingSchema.safeParse(input)
    expect(result.success).toBe(false)
    const paths = issuePaths(result)
    expect(paths).toContain('title')
    expect(paths).toContain('price')
  })

  it('rejects an out-of-range latitude', () => {
    const result = submitListingSchema.safeParse({
      ...validSale,
      location: { lat: 91, lng: 0 },
    })
    expect(result.success).toBe(false)
  })
})

// The request body for POST /api/v1/listings/{id}/status (PRD §10) —
// one field, `action`, matching services/listings/change-listing-status.ts's
// ListingStatusAction union exactly.
describe('changeListingStatusSchema', () => {
  it.each([
    'sold_stc',
    'let_agreed',
    'complete',
    'hide',
    'unhide',
    'back_on_market',
  ])('accepts action %s', (action) => {
    const result = changeListingStatusSchema.safeParse({ action })
    expect(result.success).toBe(true)
  })

  it('rejects an unrecognised action', () => {
    const result = changeListingStatusSchema.safeParse({ action: 'delete' })
    expect(result.success).toBe(false)
  })

  it('rejects a missing action', () => {
    const result = changeListingStatusSchema.safeParse({})
    expect(result.success).toBe(false)
  })
})
