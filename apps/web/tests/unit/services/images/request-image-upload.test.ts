import { afterEach, describe, expect, it } from 'vitest'

import {
  MAX_IMAGES_PER_LISTING,
  MAX_IMAGE_BYTES,
} from '@/domain/image-upload-policy'
import type { Listing } from '@/ports/listing-repository'
import type { PropertyImage } from '@/ports/property-image-repository'
import type { User } from '@/ports/user-repository'
import { AccountSuspendedError } from '@/services/auth/errors'
import { ForbiddenError } from '@/services/authz/policies'
import { TooManyImagesError } from '@/services/images/errors'
import { RequestImageUpload } from '@/services/images/request-image-upload'
import { ListingNotFoundError } from '@/ports/listing-repository'

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
  const sut = new RequestImageUpload(
    listingRepository,
    imageRepository,
    imageStorage,
  )
  return { sut, listingRepository, imageRepository, imageStorage }
}

// PRD §6.5 LST-3 — "Uploads go directly to storage via short-lived signed
// URLs."
describe('RequestImageUpload', () => {
  it('rejects a suspended actor', async () => {
    const { sut, listingRepository } = makeSut()
    listingRepository.seed(listing())

    await expect(
      sut.execute(user({ status: 'suspended' }), 'listing-1', {
        contentType: 'image/jpeg',
        bytes: 1024,
      }),
    ).rejects.toThrow(AccountSuspendedError)
  })

  it('rejects when the listing does not exist', async () => {
    const { sut } = makeSut()

    await expect(
      sut.execute(user(), 'no-such-listing', {
        contentType: 'image/jpeg',
        bytes: 1024,
      }),
    ).rejects.toThrow(ListingNotFoundError)
  })

  it("rejects a plain user who isn't the lister", async () => {
    const { sut, listingRepository } = makeSut()
    listingRepository.seed(listing({ listerId: 'someone-else' }))

    await expect(
      sut.execute(user({ role: 'user' }), 'listing-1', {
        contentType: 'image/jpeg',
        bytes: 1024,
      }),
    ).rejects.toThrow(ForbiddenError)
  })

  it('rejects once the listing already has the maximum number of images', async () => {
    const { sut, listingRepository, imageRepository } = makeSut()
    listingRepository.seed(listing())
    for (let i = 0; i < MAX_IMAGES_PER_LISTING; i++) {
      imageRepository.seed(image({ id: `img-${i}`, position: i }))
    }

    await expect(
      sut.execute(user(), 'listing-1', {
        contentType: 'image/jpeg',
        bytes: 1024,
      }),
    ).rejects.toThrow(TooManyImagesError)
  })

  it('allows a request when the listing is one under the maximum', async () => {
    const { sut, listingRepository, imageRepository } = makeSut()
    listingRepository.seed(listing())
    for (let i = 0; i < MAX_IMAGES_PER_LISTING - 1; i++) {
      imageRepository.seed(image({ id: `img-${i}`, position: i }))
    }

    await expect(
      sut.execute(user(), 'listing-1', {
        contentType: 'image/jpeg',
        bytes: 1024,
      }),
    ).resolves.toBeDefined()
  })

  it('returns a fresh imageId, an uploadUrl and the original storage path', async () => {
    const { sut, listingRepository } = makeSut()
    listingRepository.seed(listing())

    const result = await sut.execute(user(), 'listing-1', {
      contentType: 'image/jpeg',
      bytes: 1024,
    })

    expect(result.imageId).toBeTruthy()
    expect(result.uploadUrl).toContain('http://127.0.0.1')
    expect(result.path).toBe(`listings/listing-1/original/${result.imageId}`)
  })

  it('generates a different imageId on each call', async () => {
    const { sut, listingRepository } = makeSut()
    listingRepository.seed(listing())

    const first = await sut.execute(user(), 'listing-1', {
      contentType: 'image/jpeg',
      bytes: 1024,
    })
    const second = await sut.execute(user(), 'listing-1', {
      contentType: 'image/jpeg',
      bytes: 1024,
    })

    expect(first.imageId).not.toBe(second.imageId)
  })

  it('signs the upload URL for the fixed server-side max, not the declared bytes', async () => {
    const { sut, listingRepository, imageStorage } = makeSut()
    listingRepository.seed(listing())

    const result = await sut.execute(user(), 'listing-1', {
      contentType: 'image/jpeg',
      bytes: 1, // client under-declares its size
    })

    // A PUT larger than the declared `bytes` (but within MAX_IMAGE_BYTES)
    // still succeeds — proving the real constraint is MAX_IMAGE_BYTES,
    // not the client-supplied value.
    const oversizedRelativeToDeclared = new Uint8Array(2048).fill(1)
    const putResponse = await fetch(result.uploadUrl, {
      method: 'PUT',
      headers: { 'Content-Type': 'image/jpeg' },
      body: oversizedRelativeToDeclared,
    })
    expect(putResponse.ok).toBe(true)
    expect(await imageStorage.exists(result.path)).toBe(true)
    // Sanity: MAX_IMAGE_BYTES is comfortably bigger than the test payload.
    expect(MAX_IMAGE_BYTES).toBeGreaterThan(oversizedRelativeToDeclared.length)
  })

  it('an agent may request an upload for their agency listing', async () => {
    const { sut, listingRepository } = makeSut()
    listingRepository.seed(
      listing({ listerId: 'owner-x', agencyId: 'agency-1' }),
    )

    await expect(
      sut.execute(
        user({ id: 'agent-1', role: 'agent', agencyId: 'agency-1' }),
        'listing-1',
        { contentType: 'image/png', bytes: 1024 },
      ),
    ).resolves.toBeDefined()
  })
})
