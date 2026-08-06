import { describe, expect, it } from 'vitest'

import type { DraftListingInput } from '@/lib/validation/listing'
import type { Listing } from '@/ports/listing-repository'
import type { User } from '@/ports/user-repository'
import { AccountSuspendedError } from '@/services/auth/errors'
import { ForbiddenError } from '@/services/authz/policies'
import {
  ListingChannelImmutableError,
  ListingNotEditableError,
} from '@/services/listings/errors'
import { UpdateListing } from '@/services/listings/update-listing'

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

function patch(overrides: Partial<DraftListingInput> = {}): DraftListingInput {
  return { channel: 'sale', propertyType: 'flat', ...overrides }
}

function makeSut() {
  const listingRepository = new FakeListingRepository()
  const sut = new UpdateListing(listingRepository, listingRepository)
  return { sut, listingRepository }
}

// PRD §6.5 LST-4 — "editing a draft or rejected listing is unrestricted";
// "edits to a published listing go live immediately but are recorded in
// the spot-check feed (ADM-2)" (the outbox write is this commit's stand-in
// for that visibility signal — the spot-check feed itself is M5); "price
// changes are tracked ... from day one" (the events row).
describe('UpdateListing', () => {
  it('rejects a suspended actor', async () => {
    const { sut, listingRepository } = makeSut()
    listingRepository.seed(listing())

    await expect(
      sut.execute(user({ status: 'suspended' }), 'listing-1', patch()),
    ).rejects.toThrow(AccountSuspendedError)
  })

  it('rejects when the listing does not exist', async () => {
    const { sut } = makeSut()

    await expect(
      sut.execute(user(), 'no-such-listing', patch()),
    ).rejects.toThrow(/no listing/i)
  })

  it("rejects a plain user who isn't the lister", async () => {
    const { sut, listingRepository } = makeSut()
    listingRepository.seed(listing({ listerId: 'someone-else' }))

    await expect(
      sut.execute(user({ role: 'user' }), 'listing-1', patch()),
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
        patch(),
      ),
    ).rejects.toThrow(ForbiddenError)
  })

  it('allows an agent from the same agency to edit a colleague’s listing', async () => {
    const { sut, listingRepository } = makeSut()
    listingRepository.seed(
      listing({ listerId: 'other-lister', agencyId: 'agency-a' }),
    )

    const result = await sut.execute(
      user({ id: 'agent-2', role: 'agent', agencyId: 'agency-a' }),
      'listing-1',
      patch({ description: 'Updated by a colleague.' }),
    )

    expect(result.description).toBe('Updated by a colleague.')
  })

  it('allows an admin to edit any listing', async () => {
    const { sut, listingRepository } = makeSut()
    listingRepository.seed(listing({ listerId: 'someone-else' }))

    const result = await sut.execute(
      user({ role: 'admin' }),
      'listing-1',
      patch({ description: 'Admin edit.' }),
    )

    expect(result.description).toBe('Admin edit.')
  })

  it('rejects a channel change once the listing has left draft', async () => {
    const { sut, listingRepository } = makeSut()
    listingRepository.seed(
      listing({ channel: 'sale', status: 'pending_review' }),
    )

    await expect(
      sut.execute(user(), 'listing-1', patch({ channel: 'rent' })),
    ).rejects.toThrow(ListingChannelImmutableError)
  })

  // The create-listing wizard always bootstraps a fresh draft with a
  // placeholder channel ('sale') before the user ever sees step 1
  // (components/features/listings/new-listing-redirect.tsx) — wizard
  // step 1's own "For sale"/"To rent" tiles are the user's *real* choice,
  // saved via the same autosave PATCH this service backs. A draft's
  // channel has to stay changeable, or every "To rent" choice would
  // silently fail to persist (autosave swallows the resulting error, so
  // nothing downstream — not even the eventual submit — would look wrong
  // until submitListingSchema rejected the still-'sale' stored draft for
  // a reason that has nothing to do with the real problem).
  it('allows a channel change while the listing is still a draft', async () => {
    const { sut, listingRepository } = makeSut()
    listingRepository.seed(listing({ channel: 'sale', status: 'draft' }))

    const result = await sut.execute(
      user(),
      'listing-1',
      patch({ channel: 'rent', price: 1200 }),
    )

    expect(result.channel).toBe('rent')
  })

  it.each(['completed', 'hidden', 'archived'] as const)(
    'rejects an edit to a %s listing',
    async (status) => {
      const { sut, listingRepository } = makeSut()
      listingRepository.seed(listing({ status }))

      await expect(sut.execute(user(), 'listing-1', patch())).rejects.toThrow(
        ListingNotEditableError,
      )
    },
  )

  it.each(['draft', 'rejected', 'pending_review', 'published'] as const)(
    'allows an edit to a %s listing',
    async (status) => {
      const { sut, listingRepository } = makeSut()
      listingRepository.seed(listing({ status }))

      const result = await sut.execute(
        user(),
        'listing-1',
        patch({ description: 'Edited.' }),
      )

      expect(result.description).toBe('Edited.')
      expect(result.status).toBe(status)
    },
  )

  it('applies field changes for a draft edit without touching the outbox', async () => {
    const { sut, listingRepository } = makeSut()
    listingRepository.seed(listing({ status: 'draft', bedrooms: 1 }))

    const result = await sut.execute(
      user(),
      'listing-1',
      patch({ bedrooms: 3, price: 5000 }),
    )

    expect(result.bedrooms).toBe(3)
    expect(result.price).toBe(5000)
    expect(listingRepository.outboxWrites).toEqual([])
  })

  it('writes an outbox upsert row for a published-listing edit', async () => {
    const { sut, listingRepository } = makeSut()
    listingRepository.seed(listing({ status: 'published', price: 250_000 }))

    await sut.execute(user(), 'listing-1', patch({ description: 'Refreshed.' }))

    expect(listingRepository.outboxWrites).toEqual([
      { propertyId: 'listing-1', op: 'upsert' },
    ])
  })

  it('writes a price-changed event when a published listing’s price changes', async () => {
    const { sut, listingRepository } = makeSut()
    listingRepository.seed(listing({ status: 'published', price: 250_000 }))

    await sut.execute(user(), 'listing-1', patch({ price: 260_000 }))

    expect(listingRepository.priceChangeEvents).toEqual([
      { propertyId: 'listing-1', previous: 250_000, next: 260_000 },
    ])
  })

  it('writes no price-changed event when price is unchanged', async () => {
    const { sut, listingRepository } = makeSut()
    listingRepository.seed(listing({ status: 'published', price: 250_000 }))

    await sut.execute(
      user(),
      'listing-1',
      patch({ price: 250_000, description: 'Same price, new copy.' }),
    )

    expect(listingRepository.priceChangeEvents).toEqual([])
  })

  it('writes no price-changed event when price is absent from the patch', async () => {
    const { sut, listingRepository } = makeSut()
    listingRepository.seed(listing({ status: 'published', price: 250_000 }))

    await sut.execute(user(), 'listing-1', patch({ description: 'Copy only.' }))

    expect(listingRepository.priceChangeEvents).toEqual([])
  })

  it('never lets a PATCH change title or slug', async () => {
    const { sut, listingRepository } = makeSut()
    listingRepository.seed(
      listing({ title: 'Original title', slug: 'original-slug-abc123' }),
    )

    const result = await sut.execute(
      user(),
      'listing-1',
      patch({ description: 'New copy.' }),
    )

    expect(result.title).toBe('Original title')
    expect(result.slug).toBe('original-slug-abc123')
  })
})
