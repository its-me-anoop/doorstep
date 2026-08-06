import { afterEach, describe, expect, it } from 'vitest'

import type { Agency } from '@/ports/agency-repository'
import type { Listing } from '@/ports/listing-repository'
import type { PropertyImage } from '@/ports/property-image-repository'
import { NotIndexableListingError } from '@/services/search/errors'
import { mapListingToSearchDocument } from '@/services/search/map-listing-to-search-document'

import { InMemoryImageStorage } from '../../../support/in-memory-image-storage'

function listing(overrides: Partial<Listing> = {}): Listing {
  return {
    id: 'listing-1',
    listerId: 'lister-1',
    agencyId: null,
    channel: 'sale',
    status: 'published',
    propertyType: 'terraced',
    title: 'Charming terraced house',
    slug: 'charming-terraced-house',
    description: 'A lovely home.',
    features: ['garden', 'parking'],
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
    addressLine1: '12 Example Street',
    displayAddress: '12 Example Street, Reading',
    town: 'Reading',
    outcode: 'RG30',
    postcode: 'RG30 1AA',
    location: { lat: 51.4543, lng: -0.9781 },
    locationApproximate: false,
    publishedAt: new Date('2026-06-01T09:00:00Z'),
    statusChangedAt: new Date('2026-06-01T09:00:00Z'),
    rejectionReason: null,
    createdAt: new Date('2026-05-01T09:00:00Z'),
    updatedAt: new Date('2026-06-01T09:00:00Z'),
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
    width: 1600,
    height: 1200,
    blurhash: 'LGF5?xYk^6#M@-5c,1J5@[or[Q6.',
    altText: null,
    createdAt: new Date('2026-05-01T09:00:00Z'),
    updatedAt: new Date('2026-05-01T09:00:00Z'),
    ...overrides,
  }
}

function agency(overrides: Partial<Agency> = {}): Agency {
  return {
    id: 'agency-1',
    name: 'Thameside Homes',
    slug: 'thameside-homes',
    logoPath: null,
    phone: '01189 000000',
    email: 'hello@thameside.example',
    website: 'https://thameside.example',
    address: '1 High Street, Reading',
    verified: true,
    createdBy: 'user-1',
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

function makeStorage(): InMemoryImageStorage {
  const storage = new InMemoryImageStorage()
  storages.push(storage)
  return storage
}

describe('mapListingToSearchDocument', () => {
  it('maps every plain field straight through from the listing', async () => {
    const storage = makeStorage()

    const result = await mapListingToSearchDocument(
      listing(),
      [],
      null,
      storage,
    )

    expect(result).toMatchObject({
      id: 'listing-1',
      slug: 'charming-terraced-house',
      status: 'published',
      channel: 'sale',
      title: 'Charming terraced house',
      displayAddress: '12 Example Street, Reading',
      town: 'Reading',
      outcode: 'RG30',
      propertyType: 'terraced',
      bedrooms: 3,
      bathrooms: 1,
      price: 350000,
      priceQualifier: 'guide_price',
      tenure: 'freehold',
      furnished: null,
      newHome: false,
      features: ['garden', 'parking'],
      _geo: { lat: 51.4543, lng: -0.9781 },
    })
  })

  it('converts publishedAt to unix seconds', async () => {
    const storage = makeStorage()
    const publishedAt = new Date('2026-06-01T09:00:00Z')

    const result = await mapListingToSearchDocument(
      listing({ publishedAt }),
      [],
      null,
      storage,
    )

    expect(result.publishedAt).toBe(Math.floor(publishedAt.getTime() / 1000))
  })

  it('formats availableFrom as YYYY-MM-DD, and passes null through unchanged', async () => {
    const storage = makeStorage()

    const withDate = await mapListingToSearchDocument(
      listing({
        channel: 'rent',
        tenure: null,
        furnished: 'furnished',
        availableFrom: new Date('2026-09-01T00:00:00Z'),
      }),
      [],
      null,
      storage,
    )
    expect(withDate.availableFrom).toBe('2026-09-01')

    const withoutDate = await mapListingToSearchDocument(
      listing({ availableFrom: null }),
      [],
      null,
      storage,
    )
    expect(withoutDate.availableFrom).toBeNull()
  })

  it('resolves the cover image to the position-0 photo variant’s 800w webp URL', async () => {
    const storage = makeStorage()
    await storage.put(
      'listings/listing-1/variants/img-1/800.webp',
      new Uint8Array([1]),
      'image/webp',
    )

    const result = await mapListingToSearchDocument(
      listing(),
      [image({ id: 'img-1', position: 0 })],
      null,
      storage,
    )

    expect(result.coverImageUrl).toBe(
      await storage.publicUrl('listings/listing-1/variants/img-1/800.webp'),
    )
  })

  it('is null when the listing has no images', async () => {
    const storage = makeStorage()

    const result = await mapListingToSearchDocument(
      listing(),
      [],
      null,
      storage,
    )

    expect(result.coverImageUrl).toBeNull()
  })

  it('ignores a floorplan/EPC sitting at position 0 and uses the lowest-positioned photo instead', async () => {
    const storage = makeStorage()
    await storage.put(
      'listings/listing-1/variants/img-photo/800.webp',
      new Uint8Array([1]),
      'image/webp',
    )

    const result = await mapListingToSearchDocument(
      listing(),
      [
        image({ id: 'img-floorplan', kind: 'floorplan', position: 0 }),
        image({ id: 'img-photo', kind: 'photo', position: 1 }),
      ],
      null,
      storage,
    )

    expect(result.coverImageUrl).toBe(
      await storage.publicUrl('listings/listing-1/variants/img-photo/800.webp'),
    )
  })

  it('counts only kind: photo images toward imageCount', async () => {
    const storage = makeStorage()
    await storage.put(
      'listings/listing-1/variants/img-1/800.webp',
      new Uint8Array([1]),
      'image/webp',
    )

    const result = await mapListingToSearchDocument(
      listing(),
      [
        image({ id: 'img-1', kind: 'photo', position: 0 }),
        image({ id: 'img-2', kind: 'photo', position: 1 }),
        image({ id: 'img-3', kind: 'floorplan', position: 2 }),
        image({ id: 'img-4', kind: 'epc', position: 3 }),
      ],
      null,
      storage,
    )

    expect(result.imageCount).toBe(2)
  })

  it('maps a null agency to null', async () => {
    const storage = makeStorage()

    const result = await mapListingToSearchDocument(
      listing(),
      [],
      null,
      storage,
    )

    expect(result.agency).toBeNull()
  })

  it('maps an agency with no logo to a null logoUrl', async () => {
    const storage = makeStorage()

    const result = await mapListingToSearchDocument(
      listing(),
      [],
      agency({ logoPath: null }),
      storage,
    )

    expect(result.agency).toEqual({
      id: 'agency-1',
      name: 'Thameside Homes',
      logoUrl: null,
    })
  })

  it('resolves an agency logo through ImageStorage.publicUrl', async () => {
    const storage = makeStorage()
    await storage.put(
      'agencies/agency-1/logo.webp',
      new Uint8Array([1]),
      'image/webp',
    )

    const result = await mapListingToSearchDocument(
      listing(),
      [],
      agency({ logoPath: 'agencies/agency-1/logo.webp' }),
      storage,
    )

    expect(result.agency?.logoUrl).toBe(
      await storage.publicUrl('agencies/agency-1/logo.webp'),
    )
  })

  it.each([
    'draft',
    'pending_review',
    'rejected',
    'hidden',
    'completed',
    'archived',
  ] as const)('rejects a %s listing as not indexable', async (status) => {
    const storage = makeStorage()

    await expect(
      mapListingToSearchDocument(listing({ status }), [], null, storage),
    ).rejects.toThrow(NotIndexableListingError)
  })

  it.each(['published', 'under_offer'] as const)(
    'accepts a %s listing',
    async (status) => {
      const storage = makeStorage()

      await expect(
        mapListingToSearchDocument(listing({ status }), [], null, storage),
      ).resolves.toBeDefined()
    },
  )

  it('carries the listing status through to the document verbatim (not hardcoded)', async () => {
    const storage = makeStorage()

    const result = await mapListingToSearchDocument(
      listing({ status: 'under_offer' }),
      [],
      null,
      storage,
    )

    expect(result.status).toBe('under_offer')
  })
})
