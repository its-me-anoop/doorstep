import { describe, expect, it } from 'vitest'

import type { Listing } from '@/ports/listing-repository'
import type { User } from '@/ports/user-repository'
import { AccountSuspendedError } from '@/services/auth/errors'
import { ForbiddenError } from '@/services/authz/policies'
import { ListMyListings } from '@/services/listings/list-my-listings'

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
  const sut = new ListMyListings(listingRepository)
  return { sut, listingRepository }
}

// PRD §10 — GET /api/v1/listings: "My or my agency's listings". An owner
// only ever has private listings (listByLister); an agent's dashboard is
// agency-wide (listByAgency), matching canManageListing's own same-agency
// rule.
describe('ListMyListings', () => {
  it("returns an owner's own listings", async () => {
    const { sut, listingRepository } = makeSut()
    listingRepository.seed(listing({ id: 'listing-1', listerId: 'user-1' }))
    listingRepository.seed(
      listing({ id: 'listing-2', listerId: 'someone-else' }),
    )

    const result = await sut.execute(user({ role: 'owner' }))

    expect(result.data.map((l) => l.id)).toEqual(['listing-1'])
  })

  it("returns an agent's whole agency's listings, not just their own", async () => {
    const { sut, listingRepository } = makeSut()
    listingRepository.seed(
      listing({ id: 'listing-1', listerId: 'user-1', agencyId: 'agency-a' }),
    )
    listingRepository.seed(
      listing({
        id: 'listing-2',
        listerId: 'colleague',
        agencyId: 'agency-a',
      }),
    )
    listingRepository.seed(
      listing({ id: 'listing-3', listerId: 'other', agencyId: 'agency-b' }),
    )

    const result = await sut.execute(
      user({ id: 'user-1', role: 'agent', agencyId: 'agency-a' }),
    )

    expect(result.data.map((l) => l.id).sort()).toEqual([
      'listing-1',
      'listing-2',
    ])
  })

  it('passes cursor and limit through to the repository', async () => {
    const { sut, listingRepository } = makeSut()
    for (let i = 1; i <= 3; i += 1) {
      listingRepository.seed(
        listing({ id: `listing-${i}`, listerId: 'user-1' }),
      )
    }

    const firstPage = await sut.execute(user(), { limit: 1 })
    expect(firstPage.data).toHaveLength(1)
    expect(firstPage.nextCursor).not.toBeNull()

    const secondPage = await sut.execute(user(), {
      limit: 1,
      cursor: firstPage.nextCursor,
    })
    expect(secondPage.data).toHaveLength(1)
    expect(secondPage.data[0]?.id).not.toBe(firstPage.data[0]?.id)
  })

  it('rejects a plain user', async () => {
    const { sut } = makeSut()

    await expect(sut.execute(user({ role: 'user' }))).rejects.toThrow(
      ForbiddenError,
    )
  })

  it('rejects an admin (this is a lister dashboard, not an admin view)', async () => {
    const { sut } = makeSut()

    await expect(sut.execute(user({ role: 'admin' }))).rejects.toThrow(
      ForbiddenError,
    )
  })

  it('rejects a suspended actor', async () => {
    const { sut } = makeSut()

    await expect(sut.execute(user({ status: 'suspended' }))).rejects.toThrow(
      AccountSuspendedError,
    )
  })
})
