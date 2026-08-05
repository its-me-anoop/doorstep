import { describe, expect, it } from 'vitest'

import { InvalidTransitionError } from '@/domain/property-status-machine'
import type { Listing } from '@/ports/listing-repository'
import type { User } from '@/ports/user-repository'
import { AccountSuspendedError } from '@/services/auth/errors'
import { ForbiddenError } from '@/services/authz/policies'
import { ListingActionChannelMismatchError } from '@/services/listings/errors'
import { ChangeListingStatus } from '@/services/listings/change-listing-status'

import { FakeClock } from '../auth/fakes'
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
    status: 'published',
    propertyType: 'flat',
    title: 'Studio flat for sale',
    slug: 'studio-flat-abc123',
    description: '',
    features: [],
    bedrooms: 0,
    bathrooms: 0,
    price: 250_000,
    priceQualifier: 'guide_price',
    tenure: 'freehold',
    deposit: null,
    furnished: null,
    availableFrom: null,
    epcRating: null,
    councilTaxBand: null,
    newHome: false,
    addressLine1: '1 Example Road',
    displayAddress: 'Example Road, Reading',
    town: 'Reading',
    outcode: 'RG1',
    postcode: 'RG1 1AA',
    location: { lat: 51.45, lng: -0.97 },
    locationApproximate: false,
    publishedAt: new Date('2026-01-15T09:00:00Z'),
    statusChangedAt: new Date('2026-01-15T09:00:00Z'),
    rejectionReason: null,
    createdAt: new Date('2026-01-01T00:00:00Z'),
    updatedAt: new Date('2026-01-15T09:00:00Z'),
    ...overrides,
  }
}

function makeSut() {
  const listingRepository = new FakeListingRepository()
  const clock = new FakeClock(new Date('2026-02-01T12:00:00Z'))
  const sut = new ChangeListingStatus(
    listingRepository,
    listingRepository,
    clock,
  )
  return { sut, listingRepository, clock }
}

// PRD §6.5 LST-5 — "one-click transitions: mark Sold STC (sale) or Let
// Agreed (rent), complete to sold/let, hide, unhide, back on market";
// "each transition updates search visibility within 1 minute via the
// index sync" (the outbox row). PRD §9.3 draws the line at admin-only
// transitions (pending_review's own edges) — ChangeListingStatus rejects
// those with ForbiddenError rather than performing them.
describe('ChangeListingStatus', () => {
  it('rejects a suspended actor', async () => {
    const { sut, listingRepository } = makeSut()
    listingRepository.seed(listing())

    await expect(
      sut.execute(user({ status: 'suspended' }), 'listing-1', 'hide'),
    ).rejects.toThrow(AccountSuspendedError)
  })

  it('rejects when the listing does not exist', async () => {
    const { sut } = makeSut()

    await expect(
      sut.execute(user(), 'no-such-listing', 'hide'),
    ).rejects.toThrow(/no listing/i)
  })

  it("rejects a plain user who isn't the lister", async () => {
    const { sut, listingRepository } = makeSut()
    listingRepository.seed(listing({ listerId: 'someone-else' }))

    await expect(
      sut.execute(user({ role: 'user' }), 'listing-1', 'hide'),
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
        'hide',
      ),
    ).rejects.toThrow(ForbiddenError)
  })

  it('marks a sale listing sold_stc (-> under_offer)', async () => {
    const { sut, listingRepository, clock } = makeSut()
    listingRepository.seed(listing({ status: 'published', channel: 'sale' }))

    const result = await sut.execute(user(), 'listing-1', 'sold_stc')

    expect(result.status).toBe('under_offer')
    expect(result.statusChangedAt).toEqual(clock.now())
  })

  it('rejects sold_stc on a rent listing', async () => {
    const { sut, listingRepository } = makeSut()
    listingRepository.seed(listing({ status: 'published', channel: 'rent' }))

    await expect(sut.execute(user(), 'listing-1', 'sold_stc')).rejects.toThrow(
      ListingActionChannelMismatchError,
    )
  })

  it('marks a rent listing let_agreed (-> under_offer)', async () => {
    const { sut, listingRepository } = makeSut()
    listingRepository.seed(listing({ status: 'published', channel: 'rent' }))

    const result = await sut.execute(user(), 'listing-1', 'let_agreed')

    expect(result.status).toBe('under_offer')
  })

  it('rejects let_agreed on a sale listing', async () => {
    const { sut, listingRepository } = makeSut()
    listingRepository.seed(listing({ status: 'published', channel: 'sale' }))

    await expect(
      sut.execute(user(), 'listing-1', 'let_agreed'),
    ).rejects.toThrow(ListingActionChannelMismatchError)
  })

  it('completes an under_offer listing (-> completed)', async () => {
    const { sut, listingRepository } = makeSut()
    listingRepository.seed(listing({ status: 'under_offer' }))

    const result = await sut.execute(user(), 'listing-1', 'complete')

    expect(result.status).toBe('completed')
  })

  it('rejects completing a published listing directly (must go via under_offer)', async () => {
    const { sut, listingRepository } = makeSut()
    listingRepository.seed(listing({ status: 'published' }))

    await expect(sut.execute(user(), 'listing-1', 'complete')).rejects.toThrow(
      InvalidTransitionError,
    )
  })

  it('hides a published listing (-> hidden)', async () => {
    const { sut, listingRepository } = makeSut()
    listingRepository.seed(listing({ status: 'published' }))

    const result = await sut.execute(user(), 'listing-1', 'hide')

    expect(result.status).toBe('hidden')
  })

  it('unhides a hidden listing (-> published)', async () => {
    const { sut, listingRepository } = makeSut()
    listingRepository.seed(listing({ status: 'hidden' }))

    const result = await sut.execute(user(), 'listing-1', 'unhide')

    expect(result.status).toBe('published')
  })

  it('puts an under_offer listing back on the market (-> published)', async () => {
    const { sut, listingRepository } = makeSut()
    listingRepository.seed(listing({ status: 'under_offer' }))

    const result = await sut.execute(user(), 'listing-1', 'back_on_market')

    expect(result.status).toBe('published')
  })

  it('rejects hiding a draft listing (impossible transition)', async () => {
    const { sut, listingRepository } = makeSut()
    listingRepository.seed(listing({ status: 'draft' }))

    await expect(sut.execute(user(), 'listing-1', 'hide')).rejects.toThrow(
      InvalidTransitionError,
    )
  })

  it('rejects an admin-only transition (pending_review -> published) with ForbiddenError', async () => {
    const { sut, listingRepository } = makeSut()
    listingRepository.seed(listing({ status: 'pending_review' }))

    await expect(sut.execute(user(), 'listing-1', 'unhide')).rejects.toThrow(
      ForbiddenError,
    )
  })

  it('rejects that same admin-only edge even for an admin actor (not this service’s job)', async () => {
    const { sut, listingRepository } = makeSut()
    listingRepository.seed(listing({ status: 'pending_review' }))

    await expect(
      sut.execute(user({ role: 'admin' }), 'listing-1', 'unhide'),
    ).rejects.toThrow(ForbiddenError)
  })

  it('writes an outbox upsert row when the target status is published', async () => {
    const { sut, listingRepository } = makeSut()
    listingRepository.seed(listing({ status: 'hidden' }))

    await sut.execute(user(), 'listing-1', 'unhide')

    expect(listingRepository.outboxWrites).toEqual([
      { propertyId: 'listing-1', op: 'upsert' },
    ])
  })

  it('writes an outbox upsert row when the target status is under_offer', async () => {
    const { sut, listingRepository } = makeSut()
    listingRepository.seed(listing({ status: 'published' }))

    await sut.execute(user(), 'listing-1', 'sold_stc')

    expect(listingRepository.outboxWrites).toEqual([
      { propertyId: 'listing-1', op: 'upsert' },
    ])
  })

  it('writes an outbox delete row when the target status is hidden', async () => {
    const { sut, listingRepository } = makeSut()
    listingRepository.seed(listing({ status: 'published' }))

    await sut.execute(user(), 'listing-1', 'hide')

    expect(listingRepository.outboxWrites).toEqual([
      { propertyId: 'listing-1', op: 'delete' },
    ])
  })

  it('writes an outbox delete row when the target status is completed', async () => {
    const { sut, listingRepository } = makeSut()
    listingRepository.seed(listing({ status: 'under_offer' }))

    await sut.execute(user(), 'listing-1', 'complete')

    expect(listingRepository.outboxWrites).toEqual([
      { propertyId: 'listing-1', op: 'delete' },
    ])
  })

  it('does not overwrite publishedAt on an already-published listing going back on market', async () => {
    const { sut, listingRepository } = makeSut()
    const originalPublishedAt = new Date('2026-01-01T00:00:00Z')
    listingRepository.seed(
      listing({ status: 'under_offer', publishedAt: originalPublishedAt }),
    )

    const result = await sut.execute(user(), 'listing-1', 'back_on_market')

    expect(result.publishedAt).toEqual(originalPublishedAt)
  })

  it('stamps publishedAt on first publish (defensive — publishedAt was somehow still null)', async () => {
    const { sut, listingRepository, clock } = makeSut()
    listingRepository.seed(
      listing({ status: 'under_offer', publishedAt: null }),
    )

    const result = await sut.execute(user(), 'listing-1', 'back_on_market')

    expect(result.publishedAt).toEqual(clock.now())
  })

  it('does not set publishedAt for a non-publishing transition', async () => {
    const { sut, listingRepository } = makeSut()
    listingRepository.seed(listing({ status: 'published', publishedAt: null }))

    const result = await sut.execute(user(), 'listing-1', 'hide')

    expect(result.publishedAt).toBeNull()
  })
})
