import { afterEach, describe, expect, it } from 'vitest'

import type { Listing } from '@/ports/listing-repository'
import { ListingNotFoundError } from '@/ports/listing-repository'
import type { PropertyImage } from '@/ports/property-image-repository'
import type { User } from '@/ports/user-repository'
import { AccountSuspendedError } from '@/services/auth/errors'
import { ForbiddenError } from '@/services/authz/policies'
import { ListListingImages } from '@/services/images/list-listing-images'

import { InMemoryImageStorage } from '../../../support/in-memory-image-storage'
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
    width: 400,
    height: 300,
    blurhash: 'LGF5?xYk^6#M@-5c,1J5@[or[Q6.',
    altText: null,
    createdAt: new Date('2026-01-01T00:00:00Z'),
    updatedAt: new Date('2026-01-01T00:00:00Z'),
    ...overrides,
  }
}

const storages: InMemoryImageStorage[] = []

afterEach(async () => {
  await Promise.all(storages.map((storage) => storage.close()))
  storages.length = 0
})

function makeSut() {
  const listingRepository = new FakeListingRepository()
  const imageRepository = new FakePropertyImageRepository()
  const imageStorage = new InMemoryImageStorage()
  storages.push(imageStorage)
  const sut = new ListListingImages(
    listingRepository,
    imageRepository,
    imageStorage,
  )
  return { sut, listingRepository, imageRepository, imageStorage }
}

// PRD §6.5 LST-3 — the wizard's photo step reloading a draft's
// already-processed images on mount/resume.
describe('ListListingImages', () => {
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
      ListingNotFoundError,
    )
  })

  it("rejects a plain user who isn't the lister", async () => {
    const { sut, listingRepository } = makeSut()
    listingRepository.seed(listing({ listerId: 'someone-else' }))

    await expect(
      sut.execute(user({ role: 'user' }), 'listing-1'),
    ).rejects.toThrow(ForbiddenError)
  })

  it('returns an empty array for a listing with no images yet', async () => {
    const { sut, listingRepository } = makeSut()
    listingRepository.seed(listing())

    await expect(sut.execute(user(), 'listing-1')).resolves.toEqual([])
  })

  it('returns every image ordered by position, each with its variant urls attached', async () => {
    const { sut, listingRepository, imageRepository, imageStorage } = makeSut()
    listingRepository.seed(listing())
    imageRepository.seed(image({ id: 'img-2', position: 1, kind: 'floorplan' }))
    imageRepository.seed(image({ id: 'img-1', position: 0, kind: 'photo' }))
    await imageStorage.put(
      'listings/listing-1/variants/img-1/400.webp',
      new Uint8Array([1]),
      'image/webp',
    )
    await imageStorage.put(
      'listings/listing-1/variants/img-1/400.avif',
      new Uint8Array([1]),
      'image/avif',
    )
    await imageStorage.put(
      'listings/listing-1/variants/img-2/400.webp',
      new Uint8Array([1]),
      'image/webp',
    )
    await imageStorage.put(
      'listings/listing-1/variants/img-2/400.avif',
      new Uint8Array([1]),
      'image/avif',
    )

    const result = await sut.execute(user(), 'listing-1')

    expect(result.map((image) => image.id)).toEqual(['img-1', 'img-2'])
    expect(result[0]?.urls).toHaveLength(2)
    expect(result[1]?.kind).toBe('floorplan')
  })

  it('an agent may list images for their agency listing', async () => {
    const { sut, listingRepository } = makeSut()
    listingRepository.seed(
      listing({ listerId: 'owner-x', agencyId: 'agency-1' }),
    )

    await expect(
      sut.execute(
        user({ id: 'agent-1', role: 'agent', agencyId: 'agency-1' }),
        'listing-1',
      ),
    ).resolves.toEqual([])
  })
})
