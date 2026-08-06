import { inspect } from 'node:util'

import { beforeEach, describe, expect, it, vi } from 'vitest'

import type { PublicListingDetail } from '@/services/listings/get-public-listing'
import { PublicListingNotFoundError } from '@/services/listings/errors'

function serialise(node: unknown): string {
  return inspect(node, { depth: 14, breakLength: Infinity })
}

const notFoundMock = vi.fn()
vi.mock('next/navigation', () => ({
  notFound: () => notFoundMock(),
}))

const getPublicListing = { execute: vi.fn() }
vi.mock('@/lib/composition', () => ({
  createServices: () => ({
    listings: { getPublicListing },
  }),
}))

function listing(
  overrides: Partial<PublicListingDetail> = {},
): PublicListingDetail {
  return {
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
    deposit: null,
    furnished: null,
    availableFrom: null,
    epcRating: 'C',
    councilTaxBand: 'D',
    newHome: false,
    description: 'A lovely home.',
    features: ['Garden', 'Garage'],
    displayStatus: 'published',
    images: [],
    geo: { lat: 51.4543, lng: -0.9781 },
    locationApproximate: false,
    agency: null,
    publishedAt: 1750000000,
    ...overrides,
  }
}

describe('/property/[slug] page', () => {
  beforeEach(() => {
    notFoundMock.mockReset()
    getPublicListing.execute.mockReset()
  })

  it('renders the listing detail with facts, description and lister card', async () => {
    getPublicListing.execute.mockResolvedValue(listing())
    const { default: PropertyDetailPage } =
      await import('@/app/(public)/property/[slug]/page')

    const result = await PropertyDetailPage({
      params: Promise.resolve({ slug: '3-bed-semi-detached-house-rg30' }),
    })

    expect(getPublicListing.execute).toHaveBeenCalledWith(
      '3-bed-semi-detached-house-rg30',
    )
    const serialised = serialise(result)
    // The page's own JSX (breadcrumb items, direct child component props)
    // is visible here; each child component's *own* rendered output
    // (e.g. DescriptionSection's "About this home." heading) is covered
    // by that component's own dedicated test, not re-asserted here.
    expect(serialised).toContain('Oxford Road, Reading, RG30')
    expect(serialised).toContain("description: 'A lovely home.'")
    expect(serialised).toContain('agency: null')
    expect(serialised).toContain(
      "{ label: 'Reading', href: '/for-sale/reading' }",
    )
  })

  it('shows the under-offer status banner for a Sold STC listing', async () => {
    getPublicListing.execute.mockResolvedValue(
      listing({ displayStatus: 'Sold STC' }),
    )
    const { default: PropertyDetailPage } =
      await import('@/app/(public)/property/[slug]/page')

    const result = await PropertyDetailPage({
      params: Promise.resolve({ slug: 'a-slug' }),
    })

    expect(serialise(result)).toContain('Sold STC')
  })

  it('shows the agency name for an agency-listed property, not the private badge', async () => {
    getPublicListing.execute.mockResolvedValue(
      listing({
        agency: { id: 'agency-1', name: 'Barnes & Co', logoUrl: null },
      }),
    )
    const { default: PropertyDetailPage } =
      await import('@/app/(public)/property/[slug]/page')

    const result = await PropertyDetailPage({
      params: Promise.resolve({ slug: 'a-slug' }),
    })

    const serialised = serialise(result)
    expect(serialised).toContain('Barnes & Co')
    expect(serialised).not.toContain('Private seller')
  })

  it('calls notFound() for a slug GetPublicListing rejects (unknown or hidden)', async () => {
    getPublicListing.execute.mockRejectedValue(
      new PublicListingNotFoundError('missing-slug'),
    )
    const { default: PropertyDetailPage } =
      await import('@/app/(public)/property/[slug]/page')

    await PropertyDetailPage({
      params: Promise.resolve({ slug: 'missing-slug' }),
    })

    expect(notFoundMock).toHaveBeenCalled()
  })

  it('omits the area breadcrumb crumb for a town outside the curated set', async () => {
    getPublicListing.execute.mockResolvedValue(
      listing({ town: 'Henley-on-Thames', outcode: 'RG9' }),
    )
    const { default: PropertyDetailPage } =
      await import('@/app/(public)/property/[slug]/page')

    const result = await PropertyDetailPage({
      params: Promise.resolve({ slug: 'a-slug' }),
    })

    // Home / For sale / {title} — no third "area" crumb, since Henley
    // isn't a curated area (no honest link to build).
    const breadcrumb = (
      result as {
        props: {
          children: Array<{ props?: { items?: Array<{ label: string }> } }>
        }
      }
    ).props.children[0]
    expect(breadcrumb?.props?.items).toHaveLength(3)
  })
})

describe('/property/[slug] generateMetadata', () => {
  beforeEach(() => {
    getPublicListing.execute.mockReset()
  })

  it('builds a title, description and canonical link from the listing', async () => {
    getPublicListing.execute.mockResolvedValue(listing())
    const { generateMetadata } =
      await import('@/app/(public)/property/[slug]/page')

    const metadata = await generateMetadata({
      params: Promise.resolve({ slug: '3-bed-semi-detached-house-rg30' }),
    })

    expect(metadata.title).toContain('3 bed semi-detached house for sale')
    expect(metadata.alternates?.canonical).toBe(
      '/property/3-bed-semi-detached-house-rg30',
    )
  })

  it('returns empty metadata for an unknown slug rather than throwing', async () => {
    getPublicListing.execute.mockRejectedValue(
      new PublicListingNotFoundError('missing-slug'),
    )
    const { generateMetadata } =
      await import('@/app/(public)/property/[slug]/page')

    const metadata = await generateMetadata({
      params: Promise.resolve({ slug: 'missing-slug' }),
    })

    expect(metadata).toEqual({})
  })
})
