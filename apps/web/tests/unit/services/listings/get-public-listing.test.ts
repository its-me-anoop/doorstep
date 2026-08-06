import { describe, expect, it } from 'vitest'

import type { PropertyStatus } from '@/domain/enums'
import { variantImagePath } from '@/domain/image-storage-path'
import { planImageVariants } from '@/domain/image-variant-plan'
import type { Listing } from '@/ports/listing-repository'
import type { PropertyImage } from '@/ports/property-image-repository'
import { GetPublicListing } from '@/services/listings/get-public-listing'
import { PublicListingNotFoundError } from '@/services/listings/errors'

import { InMemoryImageStorage } from '../../../support/in-memory-image-storage'
import { FakePropertyImageRepository } from '../images/fakes'
import { FakeAgencyRepository } from '../listers/fakes'
import { FakeListingRepository } from './fakes'

/** Seeds every variant `attachImageUrls` (via `planImageVariants`) will
 * look up for `image` — mirroring what services/images/process-image.ts
 * always writes for real before a `property_images` row exists, so
 * `ImageStorage.publicUrl` never hits its "nothing stored at this path"
 * case for a well-formed test fixture. */
async function seedImageVariants(
  imageStorage: InMemoryImageStorage,
  image: PropertyImage,
): Promise<void> {
  for (const { width, format } of planImageVariants(image.width)) {
    await imageStorage.put(
      variantImagePath(image.propertyId, image.id, width, format),
      new Uint8Array([1]),
      `image/${format}`,
    )
  }
}

function listing(overrides: Partial<Listing> = {}): Listing {
  return {
    id: 'listing-1',
    listerId: 'user-1',
    agencyId: null,
    channel: 'sale',
    status: 'published',
    propertyType: 'semi_detached',
    title: '3 bed semi-detached house for sale',
    slug: '3-bed-semi-detached-house-rg30',
    description: 'A lovely home.\n\nSecond paragraph.',
    features: ['Garden', 'Garage'],
    bedrooms: 3,
    bathrooms: 1,
    price: 350000,
    priceQualifier: 'guide_price',
    tenure: 'freehold',
    deposit: null,
    furnished: null,
    availableFrom: null,
    epcRating: 'C',
    councilTaxBand: 'D',
    newHome: false,
    addressLine1: '12 Oxford Road',
    displayAddress: 'Oxford Road, Reading, RG30',
    town: 'Reading',
    outcode: 'RG30',
    postcode: 'RG30 1AA',
    location: { lat: 51.4543, lng: -0.9781 },
    locationApproximate: false,
    publishedAt: new Date('2026-01-01T00:00:00Z'),
    statusChangedAt: new Date('2026-01-01T00:00:00Z'),
    rejectionReason: null,
    createdAt: new Date('2026-01-01T00:00:00Z'),
    updatedAt: new Date('2026-01-01T00:00:00Z'),
    ...overrides,
  }
}

function image(overrides: Partial<PropertyImage> = {}): PropertyImage {
  return {
    id: 'image-1',
    propertyId: 'listing-1',
    kind: 'photo',
    storagePath: 'listings/listing-1/original/image-1',
    position: 0,
    width: 1600,
    height: 1200,
    blurhash: 'L6PZfSi_.AyE_3t7t7R**0o#DgR4',
    altText: null,
    createdAt: new Date('2026-01-01T00:00:00Z'),
    updatedAt: new Date('2026-01-01T00:00:00Z'),
    ...overrides,
  }
}

function makeSut() {
  const listingRepository = new FakeListingRepository()
  const propertyImageRepository = new FakePropertyImageRepository()
  const agencyRepository = new FakeAgencyRepository()
  const imageStorage = new InMemoryImageStorage()
  const sut = new GetPublicListing(
    listingRepository,
    propertyImageRepository,
    agencyRepository,
    imageStorage,
  )
  return {
    sut,
    listingRepository,
    propertyImageRepository,
    agencyRepository,
    imageStorage,
  }
}

// M2-DESIGN-SPEC.md §5, PRD §10 GET /api/v1/properties/{slug} — the
// public listing detail DTO. published/under_offer only; everything else
// 404s the same way an unknown slug does (no status oracle).
describe('GetPublicListing', () => {
  it('returns the public DTO for a published listing', async () => {
    const { sut, listingRepository, propertyImageRepository, imageStorage } =
      makeSut()
    listingRepository.seed(listing())
    const seededImage = image()
    await seedImageVariants(imageStorage, seededImage)
    propertyImageRepository.seed(seededImage)

    const result = await sut.execute('3-bed-semi-detached-house-rg30')

    expect(result).toMatchObject({
      id: 'listing-1',
      slug: '3-bed-semi-detached-house-rg30',
      channel: 'sale',
      title: '3 bed semi-detached house for sale',
      displayAddress: 'Oxford Road, Reading, RG30',
      town: 'Reading',
      outcode: 'RG30',
      propertyType: 'semi_detached',
      bedrooms: 3,
      bathrooms: 1,
      price: 350000,
      priceQualifier: 'guide_price',
      tenure: 'freehold',
      epcRating: 'C',
      councilTaxBand: 'D',
      description: 'A lovely home.\n\nSecond paragraph.',
      features: ['Garden', 'Garage'],
      displayStatus: 'published',
      geo: { lat: 51.4543, lng: -0.9781 },
      locationApproximate: false,
      agency: null,
    })
  })

  it('never exposes addressLine1 or the full postcode (PRD §9.2/DET-3)', async () => {
    const { sut, listingRepository } = makeSut()
    listingRepository.seed(listing())

    const result = await sut.execute('3-bed-semi-detached-house-rg30')

    expect(JSON.stringify(result)).not.toContain('12 Oxford Road')
    expect(JSON.stringify(result)).not.toContain('RG30 1AA')
    expect(result).not.toHaveProperty('addressLine1')
    expect(result).not.toHaveProperty('postcode')
  })

  it('includes each image with its variant URLs, blurhash and dimensions', async () => {
    const { sut, listingRepository, propertyImageRepository, imageStorage } =
      makeSut()
    listingRepository.seed(listing())
    const seededImage = image({ width: 1600 })
    await seedImageVariants(imageStorage, seededImage)
    propertyImageRepository.seed(seededImage)

    const result = await sut.execute('3-bed-semi-detached-house-rg30')

    expect(result.images).toHaveLength(1)
    expect(result.images[0]).toMatchObject({
      id: 'image-1',
      kind: 'photo',
      position: 0,
      width: 1600,
      height: 1200,
      blurhash: 'L6PZfSi_.AyE_3t7t7R**0o#DgR4',
    })
    expect(result.images[0]?.urls.length).toBeGreaterThan(0)
    expect(
      result.images[0]?.urls.every((url) => url.url.startsWith('data:')),
    ).toBe(true)
  })

  it('orders images by position', async () => {
    const { sut, listingRepository, propertyImageRepository, imageStorage } =
      makeSut()
    listingRepository.seed(listing())
    const second = image({ id: 'image-2', position: 1, kind: 'floorplan' })
    const first = image({ id: 'image-1', position: 0 })
    await seedImageVariants(imageStorage, second)
    await seedImageVariants(imageStorage, first)
    propertyImageRepository.seed(second)
    propertyImageRepository.seed(first)

    const result = await sut.execute('3-bed-semi-detached-house-rg30')

    expect(result.images.map((i) => i.id)).toEqual(['image-1', 'image-2'])
  })

  it('resolves an agency-listed property’s agency card data', async () => {
    const { sut, listingRepository, agencyRepository } = makeSut()
    agencyRepository.seed({
      id: 'agency-1',
      name: 'Barnes & Co',
      slug: 'barnes-and-co',
      logoPath: null,
      phone: '01189 000000',
      email: 'hello@barnesandco.example',
      website: 'https://barnesandco.example',
      address: '1 High Street, Reading',
      verified: true,
      createdBy: 'user-1',
      createdAt: new Date(),
      updatedAt: new Date(),
    })
    listingRepository.seed(listing({ agencyId: 'agency-1' }))

    const result = await sut.execute('3-bed-semi-detached-house-rg30')

    expect(result.agency).toEqual({
      id: 'agency-1',
      name: 'Barnes & Co',
      logoUrl: null,
    })
  })

  it('marks a private (no-agency) listing with a null agency, not a placeholder', async () => {
    const { sut, listingRepository } = makeSut()
    listingRepository.seed(listing({ agencyId: null }))

    const result = await sut.execute('3-bed-semi-detached-house-rg30')

    expect(result.agency).toBeNull()
  })

  it('returns the friendly display status for an under_offer listing', async () => {
    const { sut, listingRepository } = makeSut()
    listingRepository.seed(listing({ status: 'under_offer' }))

    const result = await sut.execute('3-bed-semi-detached-house-rg30')

    expect(result.displayStatus).toBe('Sold STC')
  })

  it('shows the rent display status correctly for an under_offer rental', async () => {
    const { sut, listingRepository } = makeSut()
    listingRepository.seed(
      listing({ channel: 'rent', status: 'under_offer', price: 1200 }),
    )

    const result = await sut.execute('3-bed-semi-detached-house-rg30')

    expect(result.displayStatus).toBe('Let Agreed')
  })

  it('throws PublicListingNotFoundError for an unknown slug', async () => {
    const { sut } = makeSut()

    await expect(sut.execute('does-not-exist')).rejects.toBeInstanceOf(
      PublicListingNotFoundError,
    )
  })

  const nonPublicStatuses: PropertyStatus[] = [
    'draft',
    'pending_review',
    'rejected',
    'completed',
    'hidden',
    'archived',
  ]

  it.each(nonPublicStatuses)(
    'throws PublicListingNotFoundError (never leaking that it exists) for status "%s"',
    async (status) => {
      const { sut, listingRepository } = makeSut()
      listingRepository.seed(listing({ status }))

      await expect(
        sut.execute('3-bed-semi-detached-house-rg30'),
      ).rejects.toBeInstanceOf(PublicListingNotFoundError)
    },
  )
})
