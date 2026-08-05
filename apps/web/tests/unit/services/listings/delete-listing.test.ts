import { describe, expect, it } from 'vitest'

import type { Listing } from '@/ports/listing-repository'
import type { User } from '@/ports/user-repository'
import { AccountSuspendedError } from '@/services/auth/errors'
import { ForbiddenError } from '@/services/authz/policies'
import { ListingNotDeletableError } from '@/services/listings/errors'
import { DeleteListing } from '@/services/listings/delete-listing'

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
  const sut = new DeleteListing(listingRepository, listingRepository)
  return { sut, listingRepository }
}

// M1-DESIGN-SPEC.md §4.3/§4.4: "Delete draft" is the one irreversible,
// non-transition action a lister can take from the dashboard, and it is
// only ever offered for a draft row — enforced here, not just hidden in
// the UI, since the API is the real authority (PRD §7.4: "never trust the
// client").
describe('DeleteListing', () => {
  it('rejects a suspended actor', async () => {
    const { sut, listingRepository } = makeSut()
    listingRepository.seed(listing())

    await expect(
      sut.execute(user({ status: 'suspended' }), 'listing-1'),
    ).rejects.toThrow(AccountSuspendedError)
  })

  it('rejects when the listing does not exist', async () => {
    const { sut } = makeSut()

    await expect(sut.execute(user(), 'no-such-listing')).rejects.toThrow(
      /no listing/i,
    )
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
      sut.execute(
        user({ role: 'agent', agencyId: 'agency-b' }),
        'listing-1',
      ),
    ).rejects.toThrow(ForbiddenError)
  })

  it.each([
    'pending_review',
    'rejected',
    'published',
    'under_offer',
    'completed',
    'hidden',
    'archived',
  ] as const)('rejects deleting a %s listing', async (status) => {
    const { sut, listingRepository } = makeSut()
    listingRepository.seed(listing({ status }))

    await expect(sut.execute(user(), 'listing-1')).rejects.toThrow(
      ListingNotDeletableError,
    )
  })

  it('deletes a draft the actor owns', async () => {
    const { sut, listingRepository } = makeSut()
    listingRepository.seed(listing({ status: 'draft' }))

    await sut.execute(user(), 'listing-1')

    expect(await listingRepository.findById('listing-1')).toBeNull()
  })

  it('allows an agent from the same agency to delete a colleague’s draft', async () => {
    const { sut, listingRepository } = makeSut()
    listingRepository.seed(
      listing({
        status: 'draft',
        listerId: 'other-lister',
        agencyId: 'agency-a',
      }),
    )

    await sut.execute(
      user({ id: 'agent-2', role: 'agent', agencyId: 'agency-a' }),
      'listing-1',
    )

    expect(await listingRepository.findById('listing-1')).toBeNull()
  })

  it('allows an admin to delete any draft', async () => {
    const { sut, listingRepository } = makeSut()
    listingRepository.seed(listing({ status: 'draft', listerId: 'someone-else' }))

    await sut.execute(user({ role: 'admin' }), 'listing-1')

    expect(await listingRepository.findById('listing-1')).toBeNull()
  })
})
