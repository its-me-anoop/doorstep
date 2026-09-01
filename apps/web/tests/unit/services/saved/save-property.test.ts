import { describe, expect, it } from 'vitest'

import { ListingNotFoundError } from '@/ports/listing-repository'
import type { Listing } from '@/ports/listing-repository'
import type { User } from '@/ports/user-repository'
import { AccountSuspendedError } from '@/services/auth/errors'
import { SaveProperty } from '@/services/saved/save-property'

import { FakeListingRepository } from '../listings/fakes'
import { FakeSavedPropertyRepository } from './fakes'

function user(): User {
  return {
    id: 'user-1',
    firebaseUid: 'firebase-user',
    email: 'user@example.co.uk',
    displayName: 'User',
    phone: null,
    role: 'user',
    agencyId: null,
    status: 'active',
  }
}

function listing(): Listing {
  return {
    id: 'listing-1',
    listerId: 'lister-1',
    agencyId: null,
    channel: 'sale',
    status: 'published',
    propertyType: 'flat',
    slug: 'studio-flat-abc',
    title: 'Studio flat',
    description: 'Cosy.',
    features: [],
    bedrooms: 1,
    bathrooms: 1,
    price: 150_000,
    priceQualifier: 'guide_price',
    tenure: 'leasehold',
    deposit: null,
    furnished: null,
    availableFrom: null,
    epcRating: null,
    councilTaxBand: null,
    newHome: false,
    addressLine1: '1 Road',
    displayAddress: 'Road, Reading',
    town: 'Reading',
    outcode: 'RG1',
    postcode: 'RG1 1AA',
    location: { lat: 51.45, lng: -0.98 },
    locationApproximate: false,
    publishedAt: new Date('2026-01-01T00:00:00Z'),
    statusChangedAt: new Date('2026-01-01T00:00:00Z'),
    rejectionReason: null,
    createdAt: new Date('2026-01-01T00:00:00Z'),
    updatedAt: new Date('2026-01-01T00:00:00Z'),
  }
}

describe('SaveProperty', () => {
  it('saves a favourite idempotently', async () => {
    const savedRepo = new FakeSavedPropertyRepository()
    const listings = new FakeListingRepository()
    listings.seed(listing())
    const service = new SaveProperty(savedRepo, listings)

    const first = await service.execute(user(), 'listing-1')
    const second = await service.execute(user(), 'listing-1')

    expect(first.propertyId).toBe('listing-1')
    expect(second).toEqual(first)
    expect(await savedRepo.isSaved('user-1', 'listing-1')).toBe(true)
  })

  it('throws ListingNotFoundError for an unknown listing', async () => {
    const service = new SaveProperty(
      new FakeSavedPropertyRepository(),
      new FakeListingRepository(),
    )

    await expect(service.execute(user(), 'missing')).rejects.toBeInstanceOf(
      ListingNotFoundError,
    )
  })

  it('rejects suspended accounts', async () => {
    const savedRepo = new FakeSavedPropertyRepository()
    const listings = new FakeListingRepository()
    listings.seed(listing())
    const service = new SaveProperty(savedRepo, listings)

    await expect(
      service.execute({ ...user(), status: 'suspended' }, 'listing-1'),
    ).rejects.toBeInstanceOf(AccountSuspendedError)
  })
})
