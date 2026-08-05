import { describe, expect, it } from 'vitest'

import {
  formValuesToDraftInput,
  listingToFormValues,
  type ListingFormValues,
} from '@/lib/listing-wizard-form'
import type { Listing } from '@/ports/listing-repository'

function freshDraft(overrides: Partial<Listing> = {}): Listing {
  return {
    id: 'listing-1',
    listerId: 'user-1',
    agencyId: null,
    channel: 'sale',
    status: 'draft',
    propertyType: 'other',
    title: 'Property for sale',
    slug: 'property-abc123',
    description: '',
    features: [],
    bedrooms: 0,
    bathrooms: 0,
    price: 0,
    priceQualifier: 'poa',
    tenure: null,
    deposit: null,
    furnished: null,
    availableFrom: null,
    epcRating: null,
    councilTaxBand: null,
    newHome: false,
    addressLine1: '',
    displayAddress: '',
    town: '',
    outcode: '',
    postcode: '',
    location: { lat: 0, lng: 0 },
    locationApproximate: false,
    publishedAt: null,
    statusChangedAt: null,
    rejectionReason: null,
    createdAt: new Date('2026-01-01'),
    updatedAt: new Date('2026-01-01'),
    ...overrides,
  }
}

// M1-DESIGN-SPEC.md §3's wizard state is one RHF form spanning steps
// 1-4; these two pure functions are the only place a stored Listing
// (server shape) and the form's own shape (select-friendly '' sentinels,
// a wizard-local displayAddressChoice, a {0,0} "not yet looked up"
// location) get translated into each other.
describe('listingToFormValues', () => {
  it('maps a brand new draft: 0-price/bathrooms and the {0,0} location sentinel read as unset', () => {
    const values = listingToFormValues(freshDraft())

    expect(values.price).toBe('')
    expect(values.bathrooms).toBe('')
    expect(values.location).toBeNull()
    // bedrooms=0 is a real, meaningful value ("Studio") — never blanked.
    expect(values.bedrooms).toBe(0)
    expect(values.displayAddressChoice).toBe('street')
  })

  it('maps a real, non-zero location straight through', () => {
    const values = listingToFormValues(
      freshDraft({ location: { lat: 51.45, lng: -0.97 } }),
    )
    expect(values.location).toEqual({ lat: 51.45, lng: -0.97 })
  })

  it('formats availableFrom as a yyyy-mm-dd date-input string', () => {
    const values = listingToFormValues(
      freshDraft({ availableFrom: new Date('2026-05-01T00:00:00.000Z') }),
    )
    expect(values.availableFrom).toBe('2026-05-01')
  })

  it('maps null enum/optional fields to the empty-string select sentinel', () => {
    const values = listingToFormValues(freshDraft())
    expect(values.tenure).toBe('')
    expect(values.furnished).toBe('')
    expect(values.epcRating).toBe('')
    expect(values.councilTaxBand).toBe('')
    expect(values.deposit).toBe('')
  })
})

describe('formValuesToDraftInput', () => {
  const base: ListingFormValues = {
    channel: 'sale',
    propertyType: 'flat',
    addressLine1: '12 Oxford Road',
    displayAddressChoice: 'street',
    displayAddress: 'Oxford Road, Reading, RG30',
    town: 'Reading',
    outcode: 'RG30',
    postcode: 'RG30 1AA',
    location: { lat: 51.45, lng: -0.97 },
    locationApproximate: false,
    bedrooms: 2,
    bathrooms: 1,
    price: 250_000,
    priceQualifier: 'fixed',
    tenure: 'freehold',
    deposit: '',
    furnished: '',
    availableFrom: '',
    epcRating: '',
    councilTaxBand: '',
    description: 'A lovely home.',
    features: ['Garden'],
  }

  it('always includes channel and propertyType (required on every PATCH per draftListingSchema)', () => {
    const input = formValuesToDraftInput({
      ...base,
      // Simulate a step-1-only draft: nothing else filled in yet.
      addressLine1: '',
      displayAddress: '',
      town: '',
      outcode: '',
      postcode: '',
      location: null,
      bedrooms: '',
      bathrooms: '',
      price: '',
      priceQualifier: '',
      description: '',
      features: [],
    })
    expect(input.channel).toBe('sale')
    expect(input.propertyType).toBe('flat')
  })

  it('drops the wizard-local displayAddressChoice field entirely', () => {
    const input = formValuesToDraftInput(base)
    expect(input).not.toHaveProperty('displayAddressChoice')
  })

  it('omits a null location rather than sending the {0,0} sentinel', () => {
    const input = formValuesToDraftInput({ ...base, location: null })
    expect(input.location).toBeUndefined()
  })

  it('omits blank ("") optional fields rather than sending empty strings', () => {
    const input = formValuesToDraftInput(base)
    expect(input.deposit).toBeUndefined()
    expect(input.furnished).toBeUndefined()
    expect(input.availableFrom).toBeUndefined()
  })

  it('passes through every filled-in field', () => {
    const input = formValuesToDraftInput(base)
    expect(input).toMatchObject({
      channel: 'sale',
      propertyType: 'flat',
      addressLine1: '12 Oxford Road',
      displayAddress: 'Oxford Road, Reading, RG30',
      town: 'Reading',
      outcode: 'RG30',
      postcode: 'RG30 1AA',
      location: { lat: 51.45, lng: -0.97 },
      bedrooms: 2,
      bathrooms: 1,
      price: 250_000,
      priceQualifier: 'fixed',
      tenure: 'freehold',
      description: 'A lovely home.',
      features: ['Garden'],
    })
  })
})
