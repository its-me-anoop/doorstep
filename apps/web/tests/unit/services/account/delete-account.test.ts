import { describe, expect, it } from 'vitest'

import type { Listing } from '@/ports/listing-repository'
import type { User } from '@/ports/user-repository'
import { DeleteAccount } from '@/services/account/delete-account'

import { FakeAuthGateway, FakeClock, FakeUserRepository } from '../auth/fakes'
import { FakeEnquiryRepository } from '../enquiries/fakes'
import { FakeListingRepository } from '../listings/fakes'
import {
  FakeSavedPropertyRepository,
  FakeSavedSearchRepository,
} from '../saved/fakes'

function actor(): User {
  return {
    id: 'user-1',
    firebaseUid: 'firebase-user-1',
    email: 'user@example.co.uk',
    displayName: 'User',
    phone: '07700900000',
    role: 'user',
    agencyId: null,
    status: 'active',
  }
}

function listing(overrides: Partial<Listing> = {}): Listing {
  return {
    id: 'listing-live',
    listerId: 'user-1',
    agencyId: null,
    channel: 'sale',
    status: 'published',
    propertyType: 'flat',
    slug: 'live-listing',
    title: 'Live listing',
    description: 'Desc',
    features: [],
    bedrooms: 2,
    bathrooms: 1,
    price: 200_000,
    priceQualifier: 'guide_price',
    tenure: 'leasehold',
    deposit: null,
    furnished: null,
    availableFrom: null,
    epcRating: null,
    councilTaxBand: null,
    newHome: false,
    addressLine1: '1 Road',
    displayAddress: 'Road',
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
    ...overrides,
  }
}

describe('DeleteAccount', () => {
  it('anonymises enquiries, clears saved data, hides live listings, deletes Firebase user and profile', async () => {
    const users = new FakeUserRepository()
    const listings = new FakeListingRepository()
    const enquiries = new FakeEnquiryRepository()
    const savedProperties = new FakeSavedPropertyRepository()
    const savedSearches = new FakeSavedSearchRepository()
    const auth = new FakeAuthGateway()
    const clock = new FakeClock(new Date('2026-02-01T12:00:00Z'))

    users.seed(actor())
    listings.seed(listing())
    listings.seed(
      listing({
        id: 'listing-draft',
        status: 'draft',
        slug: 'draft-listing',
        publishedAt: null,
      }),
    )
    await savedProperties.save('user-1', 'listing-live')
    await savedSearches.create({
      userId: 'user-1',
      name: 'Reading sale',
      criteria: {
        channel: 'sale',
        locationLabel: 'Reading',
        location: null,
        radiusMetres: null,
        filters: {},
      },
    })

    const service = new DeleteAccount(
      users,
      listings,
      listings,
      enquiries,
      savedProperties,
      savedSearches,
      auth,
      clock,
    )

    await service.execute(actor())

    expect(enquiries.anonymisedForUser).toEqual([
      { userId: 'user-1', email: 'user@example.co.uk' },
    ])
    expect(await savedProperties.listByUser('user-1')).toEqual([])
    expect(await savedSearches.listByUser('user-1')).toEqual([])
    expect(listings.outboxWrites).toEqual([
      { propertyId: 'listing-live', op: 'delete' },
    ])
    expect(await listings.findById('listing-live')).toMatchObject({
      status: 'hidden',
    })
    expect(await listings.findById('listing-draft')).toBeNull()
    expect(auth.deletedUids).toEqual(['firebase-user-1'])
    expect(await users.findById('user-1')).toBeNull()
  })
})
