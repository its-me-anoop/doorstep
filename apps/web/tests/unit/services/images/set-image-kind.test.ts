import { describe, expect, it } from 'vitest'

import type { Listing } from '@/ports/listing-repository'
import { ListingNotFoundError } from '@/ports/listing-repository'
import {
  PropertyImageNotFoundError,
  type PropertyImage,
} from '@/ports/property-image-repository'
import type { User } from '@/ports/user-repository'
import { AccountSuspendedError } from '@/services/auth/errors'
import { ForbiddenError } from '@/services/authz/policies'
import { SetImageKind } from '@/services/images/set-image-kind'

import { FakeListingRepository } from '../listings/fakes'
import { FakePropertyImageRepository } from './fakes'

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
    propertyType: 'semi_detached',
    title: '',
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

function image(overrides: Partial<PropertyImage> = {}): PropertyImage {
  return {
    id: 'img-1',
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

function makeSut() {
  const listingRepository = new FakeListingRepository()
  const imageRepository = new FakePropertyImageRepository()
  const sut = new SetImageKind(
    listingRepository,
    imageRepository,
    imageRepository,
  )
  return { sut, listingRepository, imageRepository }
}

// PRD §6.5 LST-3 — "tag an image as floorplan or EPC".
describe('SetImageKind', () => {
  it('rejects a suspended actor', async () => {
    const { sut, listingRepository } = makeSut()
    listingRepository.seed(listing())

    await expect(
      sut.execute(
        user({ status: 'suspended' }),
        'listing-1',
        'img-1',
        'floorplan',
      ),
    ).rejects.toThrow(AccountSuspendedError)
  })

  it('rejects when the listing does not exist', async () => {
    const { sut } = makeSut()

    await expect(
      sut.execute(user(), 'no-such-listing', 'img-1', 'floorplan'),
    ).rejects.toThrow(ListingNotFoundError)
  })

  it("rejects a plain user who isn't the lister", async () => {
    const { sut, listingRepository } = makeSut()
    listingRepository.seed(listing({ listerId: 'someone-else' }))

    await expect(
      sut.execute(user({ role: 'user' }), 'listing-1', 'img-1', 'epc'),
    ).rejects.toThrow(ForbiddenError)
  })

  it('rejects an unknown imageId', async () => {
    const { sut, listingRepository } = makeSut()
    listingRepository.seed(listing())

    await expect(
      sut.execute(user(), 'listing-1', 'no-such-image', 'epc'),
    ).rejects.toThrow(PropertyImageNotFoundError)
  })

  it("rejects an image that belongs to a different listing than the URL's", async () => {
    const { sut, listingRepository, imageRepository } = makeSut()
    listingRepository.seed(listing())
    listingRepository.seed(listing({ id: 'listing-2' }))
    imageRepository.seed(image({ id: 'img-1', propertyId: 'listing-2' }))

    await expect(
      sut.execute(user(), 'listing-1', 'img-1', 'epc'),
    ).rejects.toThrow(PropertyImageNotFoundError)
  })

  it.each(['photo', 'floorplan', 'epc'] as const)(
    'sets kind to %s',
    async (kind) => {
      const { sut, listingRepository, imageRepository } = makeSut()
      listingRepository.seed(listing())
      imageRepository.seed(image({ kind: 'photo' }))

      const result = await sut.execute(user(), 'listing-1', 'img-1', kind)

      expect(result.kind).toBe(kind)
    },
  )

  it('leaves position untouched', async () => {
    const { sut, listingRepository, imageRepository } = makeSut()
    listingRepository.seed(listing())
    imageRepository.seed(image({ position: 3 }))

    const result = await sut.execute(user(), 'listing-1', 'img-1', 'epc')

    expect(result.position).toBe(3)
  })
})
