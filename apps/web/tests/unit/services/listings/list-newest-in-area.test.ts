import { describe, expect, it } from 'vitest'

import type { Listing } from '@/ports/listing-repository'
import { ListNewestInArea } from '@/services/listings/list-newest-in-area'

import { InMemoryImageStorage } from '../../../support/in-memory-image-storage'
import { FakePropertyImageRepository } from '../images/fakes'
import { FakeAgencyRepository } from '../listers/fakes'
import { FakeListingRepository } from './fakes'

function listing(overrides: Partial<Listing> = {}): Listing {
  return {
    id: 'listing-1',
    listerId: 'user-1',
    agencyId: null,
    channel: 'sale',
    status: 'published',
    propertyType: 'flat',
    title: 'Studio flat for sale',
    slug: 'studio-flat-abc123',
    description: '',
    features: [],
    bedrooms: 0,
    bathrooms: 0,
    price: 250000,
    priceQualifier: 'fixed',
    tenure: 'freehold',
    deposit: null,
    furnished: null,
    availableFrom: null,
    epcRating: null,
    councilTaxBand: null,
    newHome: false,
    addressLine1: '1 Oxford Road',
    displayAddress: 'Oxford Road, Reading',
    town: 'Reading',
    outcode: 'RG1',
    postcode: 'RG1 1AA',
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

function makeSut() {
  const listingRepository = new FakeListingRepository()
  const propertyImageRepository = new FakePropertyImageRepository()
  const agencyRepository = new FakeAgencyRepository()
  const imageStorage = new InMemoryImageStorage()
  const sut = new ListNewestInArea(
    listingRepository,
    propertyImageRepository,
    agencyRepository,
    imageStorage,
  )
  return { sut, listingRepository, propertyImageRepository, agencyRepository }
}

// M2-DESIGN-SPEC.md §4.1 point 3 — the area landing page's "Newest in
// {area}" strip. Postgres-sourced (via ListingReader.listNewestPublished),
// not Meilisearch, so it survives a search-index outage (§1.10 point 4).
describe('ListNewestInArea', () => {
  it('returns published listings for the area, mapped to the public search-hit DTO', async () => {
    const { sut, listingRepository } = makeSut()
    listingRepository.seed(listing({ id: 'listing-1', town: 'Reading' }))

    const result = await sut.execute('sale', { town: 'Reading' })

    expect(result).toHaveLength(1)
    expect(result[0]).toMatchObject({
      id: 'listing-1',
      slug: 'studio-flat-abc123',
      displayAddress: 'Oxford Road, Reading',
      displayStatus: 'published',
    })
  })

  it('excludes listings outside the area', async () => {
    const { sut, listingRepository } = makeSut()
    listingRepository.seed(
      listing({ id: 'listing-1', town: 'Caversham', slug: 'a' }),
    )

    const result = await sut.execute('sale', { town: 'Reading' })

    expect(result).toEqual([])
  })

  it('matches by outcode when the area match is outcode-based', async () => {
    const { sut, listingRepository } = makeSut()
    listingRepository.seed(
      listing({ id: 'listing-1', town: 'Earley', outcode: 'RG6', slug: 'a' }),
    )
    listingRepository.seed(
      listing({
        id: 'listing-2',
        town: 'Lower Earley',
        outcode: 'RG6',
        slug: 'b',
      }),
    )

    const result = await sut.execute('sale', { outcode: 'RG6' })

    expect(result.map((hit) => hit.id).sort()).toEqual([
      'listing-1',
      'listing-2',
    ])
  })

  it('excludes under_offer and hidden listings — only published, unlike search indexing', async () => {
    const { sut, listingRepository } = makeSut()
    listingRepository.seed(
      listing({ id: 'listing-1', status: 'under_offer', slug: 'a' }),
    )
    listingRepository.seed(
      listing({ id: 'listing-2', status: 'hidden', slug: 'b' }),
    )

    const result = await sut.execute('sale', { town: 'Reading' })

    expect(result).toEqual([])
  })

  it('resolves an agency-listed property’s agency name onto the DTO', async () => {
    const { sut, listingRepository, agencyRepository } = makeSut()
    agencyRepository.seed({
      id: 'agency-1',
      name: 'Barnes & Co',
      slug: 'barnes-and-co',
      logoPath: null,
      phone: '',
      email: '',
      website: '',
      address: '',
      verified: true,
      createdBy: 'user-1',
      createdAt: new Date(),
      updatedAt: new Date(),
    })
    listingRepository.seed(
      listing({ id: 'listing-1', agencyId: 'agency-1', slug: 'a' }),
    )

    const result = await sut.execute('sale', { town: 'Reading' })

    expect(result[0]?.agency).toEqual({
      id: 'agency-1',
      name: 'Barnes & Co',
      logoUrl: null,
    })
  })

  it('caps the strip at 4 listings, newest first', async () => {
    const { sut, listingRepository } = makeSut()
    for (let i = 1; i <= 5; i++) {
      listingRepository.seed(
        listing({
          id: `listing-${i}`,
          slug: `listing-${i}`,
          publishedAt: new Date(`2026-01-0${i}T00:00:00Z`),
        }),
      )
    }

    const result = await sut.execute('sale', { town: 'Reading' })

    expect(result).toHaveLength(4)
    expect(result[0]?.id).toBe('listing-5')
  })
})
