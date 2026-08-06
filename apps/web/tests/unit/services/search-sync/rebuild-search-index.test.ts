import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import type { Listing } from '@/ports/listing-repository'
import { RebuildSearchIndex } from '@/services/search-sync'

import { InMemoryImageStorage } from '../../../support/in-memory-image-storage'
import { FakeAgencyRepository } from '../listers/fakes'
import { FakePropertyImageRepository } from '../images/fakes'
import { FakeListingRepository } from '../listings/fakes'
import { FakeSearchIndex } from './fakes'

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
    features: [],
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

describe('RebuildSearchIndex', () => {
  let listingRepository: FakeListingRepository
  let imageRepository: FakePropertyImageRepository
  let agencyRepository: FakeAgencyRepository
  let searchIndex: FakeSearchIndex
  let imageStorage: InMemoryImageStorage
  let rebuildSearchIndex: RebuildSearchIndex

  beforeEach(() => {
    listingRepository = new FakeListingRepository()
    imageRepository = new FakePropertyImageRepository()
    agencyRepository = new FakeAgencyRepository()
    searchIndex = new FakeSearchIndex()
    imageStorage = new InMemoryImageStorage()
    rebuildSearchIndex = new RebuildSearchIndex(
      listingRepository,
      imageRepository,
      agencyRepository,
      imageStorage,
      searchIndex,
    )
  })

  afterEach(async () => {
    await imageStorage.close()
  })

  it('ensures settings, clears the index, and upserts every indexable listing', async () => {
    listingRepository.seed(listing({ id: 'l1', status: 'published' }))
    listingRepository.seed(listing({ id: 'l2', status: 'under_offer' }))
    listingRepository.seed(listing({ id: 'l3', status: 'hidden' }))
    listingRepository.seed(listing({ id: 'l4', status: 'draft' }))

    const result = await rebuildSearchIndex.execute()

    expect(searchIndex.ensureSettingsCallCount).toBe(1)
    expect(searchIndex.clearCallCount).toBe(1)
    expect([...searchIndex.documents.keys()].sort()).toEqual(['l1', 'l2'])
    expect(result.indexed).toBe(2)
    expect(result.drift.postgresCount).toBe(2)
    expect(result.drift.meiliCountAfter).toBe(2)
  })

  it('clears before upserting — the index is briefly empty mid-run by design', async () => {
    const calls: string[] = []
    searchIndex.clear = vi.fn(async () => {
      calls.push('clear')
    })
    searchIndex.upsert = vi.fn(async (docs) => {
      calls.push('upsert')
      for (const doc of docs) searchIndex.documents.set(doc.id, doc)
    })
    listingRepository.seed(listing())

    await rebuildSearchIndex.execute()

    expect(calls[0]).toBe('clear')
    expect(calls).toContain('upsert')
  })

  it('reports meiliCountBefore from whatever was in the index before this run started', async () => {
    await searchIndex.upsert([
      {
        id: 'rogue',
        channel: 'sale',
        title: 'Rogue leftover doc',
        displayAddress: 'Nowhere',
        town: 'Nowhere',
        outcode: 'RG1',
        propertyType: 'flat',
        bedrooms: 1,
        bathrooms: 1,
        price: 100000,
        priceQualifier: 'fixed',
        tenure: 'freehold',
        furnished: null,
        availableFrom: null,
        newHome: false,
        features: [],
        coverImageUrl: null,
        imageCount: 0,
        agency: null,
        publishedAt: 0,
        _geo: { lat: 0, lng: 0 },
      },
    ])

    const result = await rebuildSearchIndex.execute()

    expect(result.drift.meiliCountBefore).toBe(1)
  })

  it('pages through more listings than one page fits', async () => {
    for (let i = 0; i < 5; i += 1) {
      listingRepository.seed(listing({ id: `l${i}` }))
    }
    rebuildSearchIndex = new RebuildSearchIndex(
      listingRepository,
      imageRepository,
      agencyRepository,
      imageStorage,
      searchIndex,
      2,
    )

    const result = await rebuildSearchIndex.execute()

    expect(result.indexed).toBe(5)
    expect(searchIndex.documents.size).toBe(5)
    // At least 3 upsert calls for 5 rows at a page size of 2 (2+2+1).
    expect(searchIndex.upsertCalls.length).toBeGreaterThanOrEqual(3)
  })

  it('logs a warning when the post-run count does not match the Postgres source of truth', async () => {
    listingRepository.seed(listing())
    searchIndex.setCountOverride(999)
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined)

    const result = await rebuildSearchIndex.execute()

    expect(result.drift.postgresCount).toBe(1)
    expect(result.drift.meiliCountAfter).toBe(999)
    expect(warn).toHaveBeenCalledWith(expect.stringContaining('mismatch'))
    warn.mockRestore()
  })

  it('propagates a mapping error (e.g. a corrupted publishedAt invariant) rather than swallowing it', async () => {
    listingRepository.seed(listing({ publishedAt: null }))

    await expect(rebuildSearchIndex.execute()).rejects.toThrow()
  })
})
