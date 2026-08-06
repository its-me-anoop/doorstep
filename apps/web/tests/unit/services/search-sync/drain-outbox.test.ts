import { afterEach, beforeEach, describe, expect, it } from 'vitest'

import type { Agency } from '@/ports/agency-repository'
import type { Listing } from '@/ports/listing-repository'
import type { PropertyImage } from '@/ports/property-image-repository'
import { DrainOutbox } from '@/services/search-sync'

import { InMemoryImageStorage } from '../../../support/in-memory-image-storage'
import { FakeAgencyRepository } from '../listers/fakes'
import { FakePropertyImageRepository } from '../images/fakes'
import { FakeListingRepository } from '../listings/fakes'
import { FakeOutboxRepository, FakeSearchIndex } from './fakes'

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
    features: ['garden'],
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

describe('DrainOutbox', () => {
  let listingRepository: FakeListingRepository
  let imageRepository: FakePropertyImageRepository
  let agencyRepository: FakeAgencyRepository
  let outboxRepository: FakeOutboxRepository
  let searchIndex: FakeSearchIndex
  let imageStorage: InMemoryImageStorage
  let drainOutbox: DrainOutbox

  beforeEach(() => {
    listingRepository = new FakeListingRepository()
    imageRepository = new FakePropertyImageRepository()
    agencyRepository = new FakeAgencyRepository()
    outboxRepository = new FakeOutboxRepository()
    searchIndex = new FakeSearchIndex()
    imageStorage = new InMemoryImageStorage()
    drainOutbox = new DrainOutbox(
      outboxRepository,
      listingRepository,
      imageRepository,
      agencyRepository,
      imageStorage,
      searchIndex,
    )
  })

  /** The phase-1 mapper (services/search/map-listing-to-search-document.ts)
   * resolves a cover photo's public URL for real via ImageStorage — this
   * populates the one path `image()`'s fixture (position 0, img-1) maps
   * to, so tests that seed that image don't hit
   * InMemoryImageStorage.publicUrl's "nothing stored at this path" guard.
   * Tests that don't care about the cover image simply don't seed
   * `image()` at all. */
  async function putCoverImageBytes(): Promise<void> {
    await imageStorage.put(
      'listings/listing-1/variants/img-1/800.webp',
      new Uint8Array([1]),
      'image/webp',
    )
  }

  afterEach(async () => {
    await imageStorage.close()
  })

  it('reports zeros without touching the search index when nothing is pending', async () => {
    const result = await drainOutbox.execute()

    expect(result).toEqual({
      processed: 0,
      upserts: 0,
      deletes: 0,
      pendingRemaining: 0,
    })
    expect(searchIndex.upsertCalls).toHaveLength(0)
    expect(searchIndex.deleteCalls).toHaveLength(0)
  })

  it('upserts a mapped document for an upsert-op entry whose listing is published', async () => {
    listingRepository.seed(listing())
    imageRepository.seed(image())
    await putCoverImageBytes()
    outboxRepository.enqueue('listing-1', 'upsert')

    const result = await drainOutbox.execute()

    expect(result).toEqual({
      processed: 1,
      upserts: 1,
      deletes: 0,
      pendingRemaining: 0,
    })
    expect(searchIndex.documents.get('listing-1')?.title).toBe(
      'Charming terraced house',
    )
    expect(await outboxRepository.countPending()).toBe(0)
  })

  it('resolves the agency for an upsert-op entry with an agency-owned listing', async () => {
    agencyRepository.seed(agency())
    listingRepository.seed(listing({ agencyId: 'agency-1' }))
    imageRepository.seed(image())
    await putCoverImageBytes()
    outboxRepository.enqueue('listing-1', 'upsert')

    await drainOutbox.execute()

    expect(searchIndex.documents.get('listing-1')?.agency).toEqual({
      id: 'agency-1',
      name: 'Thameside Homes',
      logoUrl: null,
    })
  })

  it('deletes directly for a delete-op entry, without loading the listing at all', async () => {
    outboxRepository.enqueue('listing-1', 'delete')

    const result = await drainOutbox.execute()

    expect(result).toEqual({
      processed: 1,
      upserts: 0,
      deletes: 1,
      pendingRemaining: 0,
    })
    expect(searchIndex.deleteCalls).toEqual([['listing-1']])
    expect(listingRepository.findById('listing-1')).resolves.toBeNull()
  })

  it('guard: an upsert-op entry whose listing is no longer indexable is treated as a delete', async () => {
    listingRepository.seed(listing({ status: 'hidden' }))
    outboxRepository.enqueue('listing-1', 'upsert')

    const result = await drainOutbox.execute()

    expect(result.upserts).toBe(0)
    expect(result.deletes).toBe(1)
    expect(searchIndex.deleteCalls).toEqual([['listing-1']])
  })

  it('guard: an upsert-op entry whose listing no longer exists is treated as a delete', async () => {
    outboxRepository.enqueue('ghost-listing', 'upsert')

    const result = await drainOutbox.execute()

    expect(result.upserts).toBe(0)
    expect(result.deletes).toBe(1)
    expect(searchIndex.deleteCalls).toEqual([['ghost-listing']])
  })

  it('last entry wins: upsert then delete for the same property resolves to a delete', async () => {
    listingRepository.seed(listing())
    imageRepository.seed(image())
    await putCoverImageBytes()
    outboxRepository.enqueue('listing-1', 'upsert', new Date(1))
    outboxRepository.enqueue('listing-1', 'delete', new Date(2))

    const result = await drainOutbox.execute()

    expect(result).toEqual({
      processed: 2,
      upserts: 0,
      deletes: 1,
      pendingRemaining: 0,
    })
    expect(searchIndex.upsertCalls).toHaveLength(0)
    expect(searchIndex.deleteCalls).toEqual([['listing-1']])
  })

  it('last entry wins: delete then upsert for the same property resolves to an upsert', async () => {
    listingRepository.seed(listing())
    imageRepository.seed(image())
    await putCoverImageBytes()
    outboxRepository.enqueue('listing-1', 'delete', new Date(1))
    outboxRepository.enqueue('listing-1', 'upsert', new Date(2))

    const result = await drainOutbox.execute()

    expect(result).toEqual({
      processed: 2,
      upserts: 1,
      deletes: 0,
      pendingRemaining: 0,
    })
    expect(searchIndex.deleteCalls).toHaveLength(0)
    expect(searchIndex.documents.has('listing-1')).toBe(true)
  })

  it('claims at most the configured batch size, reporting the rest as pendingRemaining', async () => {
    for (const id of ['a', 'b', 'c']) {
      outboxRepository.enqueue(id, 'delete')
    }
    drainOutbox = new DrainOutbox(
      outboxRepository,
      listingRepository,
      imageRepository,
      agencyRepository,
      imageStorage,
      searchIndex,
      2,
    )

    const result = await drainOutbox.execute()

    expect(result.processed).toBe(2)
    expect(result.pendingRemaining).toBe(1)
  })

  it('marks nothing processed when the Meilisearch upsert call fails, so the batch is retry-safe', async () => {
    listingRepository.seed(listing())
    imageRepository.seed(image())
    await putCoverImageBytes()
    outboxRepository.enqueue('listing-1', 'upsert')
    searchIndex.failNextUpsert(new Error('Meilisearch is down'))

    await expect(drainOutbox.execute()).rejects.toThrow('Meilisearch is down')

    expect(await outboxRepository.countPending()).toBe(1)
  })

  it('marks nothing processed when the Meilisearch delete call fails, so the batch is retry-safe', async () => {
    outboxRepository.enqueue('listing-1', 'delete')
    searchIndex.failNextDelete(new Error('Meilisearch is down'))

    await expect(drainOutbox.execute()).rejects.toThrow('Meilisearch is down')

    expect(await outboxRepository.countPending()).toBe(1)
  })
})
