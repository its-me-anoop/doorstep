import { describe, expect, it } from 'vitest'

import { InvalidTransitionError } from '@/domain/property-status-machine'
import type { Listing } from '@/ports/listing-repository'
import type { PropertyImage } from '@/ports/property-image-repository'
import type { User } from '@/ports/user-repository'
import { AccountSuspendedError } from '@/services/auth/errors'
import { ForbiddenError } from '@/services/authz/policies'
import { ListingIncompleteError } from '@/services/listings/errors'
import { SubmitListing } from '@/services/listings/submit-listing'

import { FakeClock } from '../auth/fakes'
import { FakePropertyImageRepository } from '../images/fakes'
import { FakeListingRepository } from './fakes'

function photo(overrides: Partial<PropertyImage> = {}): PropertyImage {
  return {
    id: `img-${crypto.randomUUID()}`,
    propertyId: 'listing-1',
    kind: 'photo',
    storagePath: 'listings/listing-1/original/img-1',
    position: 0,
    width: 800,
    height: 600,
    blurhash: 'LGF5?xYk^6#M@-5c,1J5@[or[Q6.',
    altText: null,
    createdAt: new Date('2026-01-01T00:00:00Z'),
    updatedAt: new Date('2026-01-01T00:00:00Z'),
    ...overrides,
  }
}

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

const completeSaleFields = {
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

function listing(overrides: Partial<Listing> = {}): Listing {
  return {
    id: 'listing-1',
    listerId: 'user-1',
    agencyId: null,
    channel: 'sale',
    status: 'draft',
    propertyType: 'semi_detached',
    slug: 'studio-flat-abc123',
    tenure: null,
    deposit: null,
    furnished: null,
    availableFrom: null,
    epcRating: null,
    councilTaxBand: null,
    newHome: false,
    location: { lat: 0, lng: 0 },
    locationApproximate: false,
    publishedAt: null,
    statusChangedAt: null,
    rejectionReason: null,
    createdAt: new Date('2026-01-01T00:00:00Z'),
    updatedAt: new Date('2026-01-01T00:00:00Z'),
    title: '',
    description: '',
    features: [],
    bedrooms: 0,
    bathrooms: 0,
    price: 0,
    priceQualifier: 'poa',
    addressLine1: '',
    displayAddress: '',
    town: '',
    outcode: '',
    postcode: '',
    ...overrides,
  }
}

function makeSut() {
  const listingRepository = new FakeListingRepository()
  const imageRepository = new FakePropertyImageRepository()
  const clock = new FakeClock(new Date('2026-02-01T12:00:00Z'))
  const sut = new SubmitListing(
    listingRepository,
    listingRepository,
    imageRepository,
    clock,
  )
  return { sut, listingRepository, imageRepository, clock }
}

// PRD §6.5 LST-2 — "submission moves the listing to pending review"; PRD
// §9.3 — the draft/rejected -> pending_review edge is the only one a
// lister triggers directly (SubmitListing), gated on
// lib/validation/listing.ts's strict submitListingSchema.
describe('SubmitListing', () => {
  it('rejects a suspended actor', async () => {
    const { sut, listingRepository } = makeSut()
    listingRepository.seed(listing({ status: 'draft', ...completeSaleFields }))

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
    listingRepository.seed(
      listing({
        status: 'draft',
        listerId: 'someone-else',
        ...completeSaleFields,
      }),
    )

    await expect(
      sut.execute(user({ role: 'user' }), 'listing-1'),
    ).rejects.toThrow(ForbiddenError)
  })

  it('submits a complete draft sale listing to pending_review', async () => {
    const { sut, listingRepository, imageRepository, clock } = makeSut()
    listingRepository.seed(listing({ status: 'draft', ...completeSaleFields }))
    imageRepository.seed(photo())

    const result = await sut.execute(user(), 'listing-1')

    expect(result.status).toBe('pending_review')
    expect(result.statusChangedAt).toEqual(clock.now())
  })

  it('submits a complete rejected listing back to pending_review', async () => {
    const { sut, listingRepository, imageRepository } = makeSut()
    imageRepository.seed(photo())
    listingRepository.seed(
      listing({
        status: 'rejected',
        rejectionReason: 'Poor photos',
        ...completeSaleFields,
      }),
    )

    const result = await sut.execute(user(), 'listing-1')

    expect(result.status).toBe('pending_review')
  })

  it('does not write an outbox row (pending_review is never publicly visible)', async () => {
    const { sut, listingRepository, imageRepository } = makeSut()
    listingRepository.seed(listing({ status: 'draft', ...completeSaleFields }))
    imageRepository.seed(photo())

    await sut.execute(user(), 'listing-1')

    expect(listingRepository.outboxWrites).toEqual([])
  })

  it.each([
    'pending_review',
    'published',
    'under_offer',
    'completed',
    'hidden',
    'archived',
  ] as const)('rejects submitting from status %s', async (status) => {
    const { sut, listingRepository } = makeSut()
    listingRepository.seed(listing({ status, ...completeSaleFields }))

    await expect(sut.execute(user(), 'listing-1')).rejects.toThrow(
      InvalidTransitionError,
    )
  })

  it('rejects an incomplete sale listing (missing tenure)', async () => {
    const { sut, listingRepository } = makeSut()
    listingRepository.seed(
      listing({ status: 'draft', ...completeSaleFields, tenure: null }),
    )

    const error = await sut
      .execute(user(), 'listing-1')
      .catch((e: unknown) => e)

    expect(error).toBeInstanceOf(ListingIncompleteError)
    expect(
      (error as InstanceType<typeof ListingIncompleteError>).issues,
    ).toEqual(
      expect.arrayContaining([expect.objectContaining({ path: 'tenure' })]),
    )
  })

  it('leaves an incomplete listing in its original status', async () => {
    const { sut, listingRepository } = makeSut()
    listingRepository.seed(
      listing({ status: 'draft', ...completeSaleFields, title: '' }),
    )

    await expect(sut.execute(user(), 'listing-1')).rejects.toThrow(
      ListingIncompleteError,
    )
    expect((await listingRepository.findById('listing-1'))?.status).toBe(
      'draft',
    )
  })

  it('rejects an incomplete rent listing (missing EPC rating)', async () => {
    const { sut, listingRepository } = makeSut()
    listingRepository.seed(
      listing({
        status: 'draft',
        channel: 'rent',
        propertyType: 'flat',
        title: '2 bed flat to rent',
        description: 'A lovely flat.',
        bedrooms: 2,
        bathrooms: 1,
        price: 1500,
        priceQualifier: 'fixed',
        addressLine1: '2 Example Road',
        displayAddress: 'Example Road, Reading, RG1',
        town: 'Reading',
        outcode: 'RG1',
        postcode: 'RG1 1AA',
        location: { lat: 51.45, lng: -0.97 },
        epcRating: null,
      }),
    )

    const error = await sut
      .execute(user(), 'listing-1')
      .catch((e: unknown) => e)

    expect(error).toBeInstanceOf(ListingIncompleteError)
    expect(
      (error as InstanceType<typeof ListingIncompleteError>).issues,
    ).toEqual(
      expect.arrayContaining([expect.objectContaining({ path: 'epcRating' })]),
    )
  })

  it('accepts a complete rent listing (no tenure, has EPC rating)', async () => {
    const { sut, listingRepository, imageRepository } = makeSut()
    imageRepository.seed(photo())
    listingRepository.seed(
      listing({
        status: 'draft',
        channel: 'rent',
        propertyType: 'flat',
        title: '2 bed flat to rent',
        description: 'A lovely flat.',
        bedrooms: 2,
        bathrooms: 1,
        price: 1500,
        priceQualifier: 'fixed',
        addressLine1: '2 Example Road',
        displayAddress: 'Example Road, Reading, RG1',
        town: 'Reading',
        outcode: 'RG1',
        postcode: 'RG1 1AA',
        location: { lat: 51.45, lng: -0.97 },
        epcRating: 'C',
      }),
    )

    const result = await sut.execute(user(), 'listing-1')

    expect(result.status).toBe('pending_review')
  })

  // PRD §6.5 LST-3 — "published-bound listings need a cover" (position 0).
  describe('photo minimum', () => {
    it('rejects an otherwise-complete listing with zero images', async () => {
      const { sut, listingRepository } = makeSut()
      listingRepository.seed(
        listing({ status: 'draft', ...completeSaleFields }),
      )

      const error = await sut
        .execute(user(), 'listing-1')
        .catch((e: unknown) => e)

      expect(error).toBeInstanceOf(ListingIncompleteError)
      expect(
        (error as InstanceType<typeof ListingIncompleteError>).issues,
      ).toEqual(
        expect.arrayContaining([expect.objectContaining({ path: 'images' })]),
      )
    })

    it('leaves the listing in its original status when the photo minimum is not met', async () => {
      const { sut, listingRepository } = makeSut()
      listingRepository.seed(
        listing({ status: 'draft', ...completeSaleFields }),
      )

      await expect(sut.execute(user(), 'listing-1')).rejects.toThrow(
        ListingIncompleteError,
      )
      expect((await listingRepository.findById('listing-1'))?.status).toBe(
        'draft',
      )
    })

    it('accepts a listing with exactly one image', async () => {
      const { sut, listingRepository, imageRepository } = makeSut()
      listingRepository.seed(
        listing({ status: 'draft', ...completeSaleFields }),
      )
      imageRepository.seed(photo())

      await expect(sut.execute(user(), 'listing-1')).resolves.toMatchObject({
        status: 'pending_review',
      })
    })

    it('a floorplan-only listing (no photo-kind image) still meets the minimum', async () => {
      // Documented M1 simplification (see submit-listing.ts's doc
      // comment): the count is not filtered by kind.
      const { sut, listingRepository, imageRepository } = makeSut()
      listingRepository.seed(
        listing({ status: 'draft', ...completeSaleFields }),
      )
      imageRepository.seed(photo({ kind: 'floorplan' }))

      await expect(sut.execute(user(), 'listing-1')).resolves.toMatchObject({
        status: 'pending_review',
      })
    })
  })
})
