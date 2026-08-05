import sharp from 'sharp'
import { isBlurhashValid } from 'blurhash'
import { afterEach, describe, expect, it } from 'vitest'

import {
  originalImagePath,
  variantImagePath,
} from '@/domain/image-storage-path'
import type { Listing } from '@/ports/listing-repository'
import { ListingNotFoundError } from '@/ports/listing-repository'
import type { User } from '@/ports/user-repository'
import { AccountSuspendedError } from '@/services/auth/errors'
import { ForbiddenError } from '@/services/authz/policies'
import { OriginalImageNotFoundError } from '@/services/images/errors'
import { ProcessImage } from '@/services/images/process-image'

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

async function jpegBuffer(
  width: number,
  height: number,
  options: { injectGps?: boolean; orientation?: number } = {},
): Promise<Buffer> {
  let pipeline = sharp({
    create: {
      width,
      height,
      channels: 3,
      background: { r: 180, g: 90, b: 40 },
    },
  }).jpeg()

  if (options.orientation) {
    // withMetadata's `orientation` is sharp's documented way to set the
    // EXIF Orientation tag (a raw IFD0 "Orientation" string entry is
    // *not* honoured the same way — verified against this sharp version).
    pipeline = pipeline.withMetadata({ orientation: options.orientation })
  }
  if (options.injectGps) {
    // sharp's withExifMerge only exposes the IFD0-3 dictionaries (no
    // distinct GPS-IFD key) — GPSLatitude is written into IFD0 here
    // rather than a real GPS sub-IFD. That is enough to prove this test's
    // real point: process-image.ts's sharp re-encode strips *all* EXIF
    // (asserted below via metadata().exif being undefined on the output),
    // and a dropped EXIF blob necessarily takes any GPS data embedded in
    // it along with everything else.
    pipeline = pipeline.withExifMerge({
      IFD0: { GPSLatitude: '51.4543' },
    })
  }

  return pipeline.toBuffer()
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
  const sut = new ProcessImage(
    listingRepository,
    imageRepository,
    imageRepository,
    imageStorage,
  )
  return { sut, listingRepository, imageRepository, imageStorage }
}

describe('ProcessImage', () => {
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

  it('rejects processing when no original was uploaded', async () => {
    const { sut, listingRepository } = makeSut()
    listingRepository.seed(listing())

    await expect(sut.execute(user(), 'listing-1', 'img-1')).rejects.toThrow(
      OriginalImageNotFoundError,
    )
  })

  it('processes a real JPEG: strips EXIF/GPS, bakes orientation, generates variants, computes blurhash, inserts the row', async () => {
    const { sut, listingRepository, imageRepository, imageStorage } = makeSut()
    listingRepository.seed(listing())
    const originalPath = originalImagePath('listing-1', 'img-1')
    const original = await jpegBuffer(1200, 800, {
      injectGps: true,
      orientation: 6, // rotated 90° CW
    })
    await imageStorage.put(originalPath, new Uint8Array(original), 'image/jpeg')

    const result = await sut.execute(user(), 'listing-1', 'img-1')

    // Orientation 6 swaps width/height once baked in.
    expect(result.width).toBe(800)
    expect(result.height).toBe(1200)
    expect(result.kind).toBe('photo')
    expect(result.storagePath).toBe(originalPath)
    expect(result.position).toBe(0)
    expect(result.id).toBe('img-1')
    expect(result.propertyId).toBe('listing-1')
    expect(isBlurhashValid(result.blurhash).result).toBe(true)

    // Every planned variant was written.
    for (const width of [400, 800]) {
      for (const format of ['webp', 'avif'] as const) {
        const path = variantImagePath('listing-1', 'img-1', width, format)
        expect(await imageStorage.exists(path)).toBe(true)
      }
    }
    // 1600 is larger than the (rotated) original width of 800, so it must
    // not have been generated (domain/image-variant-plan.ts never upscales).
    expect(
      await imageStorage.exists(
        variantImagePath('listing-1', 'img-1', 1600, 'webp'),
      ),
    ).toBe(false)

    // The row was actually persisted, not just returned.
    expect(await imageRepository.findById('img-1')).toEqual(result)

    // EXIF/GPS is gone from every generated variant.
    const variantBytes = await imageStorage.get(
      variantImagePath('listing-1', 'img-1', 400, 'webp'),
    )
    const variantMetadata = await sharp(Buffer.from(variantBytes!)).metadata()
    expect(variantMetadata.exif).toBeUndefined()
  })

  it('assigns position as the next available slot (existing image count)', async () => {
    const { sut, listingRepository, imageRepository, imageStorage } = makeSut()
    listingRepository.seed(listing())
    imageRepository.seed({
      id: 'img-existing',
      propertyId: 'listing-1',
      kind: 'photo',
      storagePath: 'listings/listing-1/original/img-existing',
      position: 0,
      width: 400,
      height: 300,
      blurhash: 'LGF5?xYk^6#M@-5c,1J5@[or[Q6.',
      altText: null,
      createdAt: new Date(),
      updatedAt: new Date(),
    })
    const originalPath = originalImagePath('listing-1', 'img-new')
    await imageStorage.put(
      originalPath,
      new Uint8Array(await jpegBuffer(400, 400)),
      'image/jpeg',
    )

    const result = await sut.execute(user(), 'listing-1', 'img-new')

    expect(result.position).toBe(1)
  })

  it('produces a single (unupscaled) variant pair when the original is smaller than 400px', async () => {
    const { sut, listingRepository, imageStorage } = makeSut()
    listingRepository.seed(listing())
    const originalPath = originalImagePath('listing-1', 'img-tiny')
    await imageStorage.put(
      originalPath,
      new Uint8Array(await jpegBuffer(200, 150)),
      'image/jpeg',
    )

    const result = await sut.execute(user(), 'listing-1', 'img-tiny')

    expect(result.width).toBe(200)
    expect(
      await imageStorage.exists(
        variantImagePath('listing-1', 'img-tiny', 200, 'webp'),
      ),
    ).toBe(true)
    expect(
      await imageStorage.exists(
        variantImagePath('listing-1', 'img-tiny', 400, 'webp'),
      ),
    ).toBe(false)
  })
})
