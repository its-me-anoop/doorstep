import { describe, expect, it } from 'vitest'

import type { Listing } from '@/ports/listing-repository'
import type { User } from '@/ports/user-repository'
import { AccountSuspendedError } from '@/services/auth/errors'
import { ForbiddenError } from '@/services/authz/policies'
import { GetListing } from '@/services/listings/get-listing'

import { FakeListingRepository } from './fakes'

function user(overrides: Partial<User> = {}): User {
  return {
    id: 'user-1',
    firebaseUid: 'firebase-uid-1',
    email: 'jamie@example.co.uk',
    displayName: 'Jamie Example',
    role: 'owner',
    agencyId: null,
    status: 'active',
    ...overrides,
  }
}

function listing(overrides: Partial<Listing> = {}): Listing {
  return {
    id: 'listing-1',
    listerId: 'user-1',
    agencyId: null,
    channel: 'sale',
    status: 'draft',
    propertyType: 'flat',
    title: 'Studio flat for sale',
    slug: 'studio-flat-abc123',
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
    createdAt: new Date('2026-01-01T00:00:00Z'),
    updatedAt: new Date('2026-01-01T00:00:00Z'),
    ...overrides,
  }
}

function makeSut() {
  const listingRepository = new FakeListingRepository()
  const sut = new GetListing(listingRepository)
  return { sut, listingRepository }
}

// PRD §10 — GET /api/v1/listings/{id} is object-level (manager only) in
// M1; the public detail page is reached by slug and lands in M2.
describe('GetListing', () => {
  it('returns the listing for its own lister', async () => {
    const { sut, listingRepository } = makeSut()
    listingRepository.seed(listing())

    const result = await sut.execute(user(), 'listing-1')

    expect(result.id).toBe('listing-1')
  })

  it('returns the listing for a same-agency agent', async () => {
    const { sut, listingRepository } = makeSut()
    listingRepository.seed(
      listing({ listerId: 'other-lister', agencyId: 'agency-a' }),
    )

    const result = await sut.execute(
      user({ role: 'agent', agencyId: 'agency-a' }),
      'listing-1',
    )

    expect(result.id).toBe('listing-1')
  })

  it('returns the listing for an admin regardless of ownership', async () => {
    const { sut, listingRepository } = makeSut()
    listingRepository.seed(listing({ listerId: 'someone-else' }))

    const result = await sut.execute(user({ role: 'admin' }), 'listing-1')

    expect(result.id).toBe('listing-1')
  })

  it("rejects a plain user who isn't the lister", async () => {
    const { sut, listingRepository } = makeSut()
    listingRepository.seed(listing({ listerId: 'someone-else' }))

    await expect(
      sut.execute(user({ role: 'user' }), 'listing-1'),
    ).rejects.toThrow(ForbiddenError)
  })

  it('rejects an agent from a different agency', async () => {
    const { sut, listingRepository } = makeSut()
    listingRepository.seed(
      listing({ listerId: 'other-lister', agencyId: 'agency-a' }),
    )

    await expect(
      sut.execute(user({ role: 'agent', agencyId: 'agency-b' }), 'listing-1'),
    ).rejects.toThrow(ForbiddenError)
  })

  it('rejects when the listing does not exist', async () => {
    const { sut } = makeSut()

    await expect(sut.execute(user(), 'no-such-listing')).rejects.toThrow(
      /no listing/i,
    )
  })

  it('rejects a suspended actor', async () => {
    const { sut, listingRepository } = makeSut()
    listingRepository.seed(listing())

    await expect(
      sut.execute(user({ status: 'suspended' }), 'listing-1'),
    ).rejects.toThrow(AccountSuspendedError)
  })
})
