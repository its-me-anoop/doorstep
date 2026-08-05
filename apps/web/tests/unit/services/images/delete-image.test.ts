import { afterEach, describe, expect, it } from 'vitest'

import {
  originalImagePath,
  variantImagePath,
} from '@/domain/image-storage-path'
import type { Listing } from '@/ports/listing-repository'
import { ListingNotFoundError } from '@/ports/listing-repository'
import {
  PropertyImageNotFoundError,
  type PropertyImage,
} from '@/ports/property-image-repository'
import type { User } from '@/ports/user-repository'
import { AccountSuspendedError } from '@/services/auth/errors'
import { ForbiddenError } from '@/services/authz/policies'
import { DeleteImage } from '@/services/images/delete-image'

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
    storagePath: originalImagePath('listing-1', 'img-1'),
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
  const sut = new DeleteImage(
    listingRepository,
    imageRepository,
    imageRepository,
    imageStorage,
  )
  return { sut, listingRepository, imageRepository, imageStorage }
}

describe('DeleteImage', () => {
  it('rejects a suspended actor', async () => {
    const { sut, listingRepository } = makeSut()
    listingRepository.seed(listing())

    await expect(
      sut.execute(user({ status: 'suspended' }), 'listing-1', 'img-1'),
    ).rejects.toThrow(AccountSuspendedError)
  })

  it('rejects when the listing does not exist', async () => {
    const { sut } = makeSut()

    await expect(
      sut.execute(user(), 'no-such-listing', 'img-1'),
    ).rejects.toThrow(ListingNotFoundError)
  })

  it("rejects a plain user who isn't the lister", async () => {
    const { sut, listingRepository } = makeSut()
    listingRepository.seed(listing({ listerId: 'someone-else' }))

    await expect(
      sut.execute(user({ role: 'user' }), 'listing-1', 'img-1'),
    ).rejects.toThrow(ForbiddenError)
  })

  it('rejects an unknown imageId', async () => {
    const { sut, listingRepository } = makeSut()
    listingRepository.seed(listing())

    await expect(
      sut.execute(user(), 'listing-1', 'no-such-image'),
    ).rejects.toThrow(PropertyImageNotFoundError)
  })

  it("rejects an image that belongs to a different listing than the URL's", async () => {
    const { sut, listingRepository, imageRepository } = makeSut()
    listingRepository.seed(listing())
    listingRepository.seed(listing({ id: 'listing-2' }))
    imageRepository.seed(image({ id: 'img-1', propertyId: 'listing-2' }))

    await expect(sut.execute(user(), 'listing-1', 'img-1')).rejects.toThrow(
      PropertyImageNotFoundError,
    )
  })

  it('deletes the row', async () => {
    const { sut, listingRepository, imageRepository } = makeSut()
    listingRepository.seed(listing())
    imageRepository.seed(image())

    await sut.execute(user(), 'listing-1', 'img-1')

    expect(await imageRepository.findById('img-1')).toBeNull()
  })

  it('deletes the original and every planned variant from storage', async () => {
    const { sut, listingRepository, imageRepository, imageStorage } = makeSut()
    listingRepository.seed(listing())
    imageRepository.seed(image({ width: 900 })) // plans 400 and 800 widths

    const originalPath = originalImagePath('listing-1', 'img-1')
    await imageStorage.put(originalPath, new Uint8Array([1]), 'image/jpeg')
    const variantPaths = [400, 800].flatMap((width) =>
      (['webp', 'avif'] as const).map((format) =>
        variantImagePath('listing-1', 'img-1', width, format),
      ),
    )
    for (const path of variantPaths) {
      await imageStorage.put(path, new Uint8Array([1]), `image/webp`)
    }

    await sut.execute(user(), 'listing-1', 'img-1')

    expect(await imageStorage.exists(originalPath)).toBe(false)
    for (const path of variantPaths) {
      expect(await imageStorage.exists(path)).toBe(false)
    }
  })

  it('still deletes the row even if a storage object was already gone', async () => {
    const { sut, listingRepository, imageRepository } = makeSut()
    listingRepository.seed(listing())
    imageRepository.seed(image()) // nothing ever put() into storage

    await expect(
      sut.execute(user(), 'listing-1', 'img-1'),
    ).resolves.toBeUndefined()
    expect(await imageRepository.findById('img-1')).toBeNull()
  })
})
