import { describe, expect, it } from 'vitest'

import {
  validateWizardStep,
  WIZARD_STEP_FIELDS,
} from '@/lib/validation/listing-wizard'

const baseSale = {
  channel: 'sale' as const,
  propertyType: 'flat' as const,
  addressLine1: '12 Oxford Road',
  displayAddress: 'Oxford Road, Reading, RG30',
  town: 'Reading',
  outcode: 'RG30',
  postcode: 'RG30 1AA',
  location: { lat: 51.45, lng: -0.97 },
  bedrooms: 2,
  bathrooms: 1,
  price: 250_000,
  priceQualifier: 'fixed' as const,
  tenure: 'freehold' as const,
  description: 'A lovely home.',
}

// PRD §6.5 LST-2 step gating (M1-DESIGN-SPEC.md §1.1: "Continue" re-runs
// the strict schema for the step's own fields only). validateWizardStep
// reuses submitListingSchema wholesale rather than hand-rolling a second
// copy of channel-conditional requiredness — these tests exist to prove
// that reuse actually produces per-step-scoped results, not to
// re-litigate submitListingSchema's own rules (already covered by
// listing.test.ts).
describe('validateWizardStep', () => {
  it('step 1 is valid once channel and propertyType are present, independent of every other field', () => {
    const result = validateWizardStep(1, {
      channel: 'sale',
      propertyType: 'flat',
    })
    expect(result.valid).toBe(true)
    expect(result.fieldErrors).toEqual({})
  })

  it('step 1 is invalid with a friendly, overridden message when channel is missing', () => {
    const result = validateWizardStep(1, { propertyType: 'flat' })
    expect(result.valid).toBe(false)
    expect(result.fieldErrors.channel).toBe('Choose for sale or to rent.')
  })

  it('step 2 requires the full address field set', () => {
    const result = validateWizardStep(2, { ...baseSale, addressLine1: '' })
    expect(result.valid).toBe(false)
    expect(result.fieldErrors.addressLine1).toBe('Enter address line 1.')
    // Step 1's own fields are untouched by a step-2 check, even though
    // this synthetic object satisfies them.
    expect(result.fieldErrors.channel).toBeUndefined()
  })

  it('step 2 flags a missing location with the overridden postcode-lookup message', () => {
    // eslint-disable-next-line @typescript-eslint/no-unused-vars -- destructured only to omit it below
    const { location, ...withoutLocation } = baseSale
    const result = validateWizardStep(2, withoutLocation)
    expect(result.fieldErrors.location).toBe(
      'Look up your postcode to set the location.',
    )
  })

  it('step 3 requires tenure for a sale listing but not epcRating', () => {
    // eslint-disable-next-line @typescript-eslint/no-unused-vars -- destructured only to omit it below
    const { tenure, ...withoutTenure } = baseSale
    const result = validateWizardStep(3, withoutTenure)
    expect(result.valid).toBe(false)
    expect(result.fieldErrors.tenure).toBe(
      'Tenure is required for sale listings.',
    )
    expect(result.fieldErrors.epcRating).toBeUndefined()
  })

  it('step 3 requires epcRating for a rent listing but not tenure', () => {
    const rent = {
      ...baseSale,
      channel: 'rent' as const,
      priceQualifier: 'fixed' as const,
      tenure: null,
      epcRating: undefined,
    }
    const result = validateWizardStep(3, rent)
    expect(result.valid).toBe(false)
    expect(result.fieldErrors.epcRating).toBe(
      'EPC rating is required for rental listings.',
    )
    expect(result.fieldErrors.tenure).toBeUndefined()
  })

  it('step 3 is valid for a complete sale listing', () => {
    const result = validateWizardStep(3, baseSale)
    expect(result.valid).toBe(true)
  })

  it('step 4 requires a non-empty description only', () => {
    const result = validateWizardStep(4, { ...baseSale, description: '' })
    expect(result.valid).toBe(false)
    expect(result.fieldErrors.description).toBe('Add a description.')
    expect(Object.keys(result.fieldErrors)).toEqual(['description'])
  })

  it('exposes each step’s own field list for the review-step rollup', () => {
    expect(WIZARD_STEP_FIELDS[1]).toEqual(['channel', 'propertyType'])
    expect(WIZARD_STEP_FIELDS[4]).toEqual(['description'])
  })
})
