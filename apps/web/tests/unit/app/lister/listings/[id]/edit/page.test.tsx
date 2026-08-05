import { describe, expect, it, vi, beforeEach } from 'vitest'

const redirectMock = vi.fn()
const notFoundMock = vi.fn()
vi.mock('next/navigation', () => ({
  redirect: (path: string) => redirectMock(path),
  notFound: () => notFoundMock(),
}))

const getSessionUserMock = vi.fn()
vi.mock('@/lib/session', () => ({
  getSessionUser: () => getSessionUserMock(),
}))

const executeMock = vi.fn()
vi.mock('@/lib/composition', () => ({
  createServices: () => ({
    listings: { getListing: { execute: executeMock } },
  }),
}))

import { ForbiddenError } from '@/services/authz/policies'
import { ListingNotFoundError } from '@/ports/listing-repository'
import type { Listing } from '@/ports/listing-repository'

function listing(overrides: Partial<Listing> = {}): Listing {
  return {
    id: 'listing-1',
    listerId: 'user-1',
    agencyId: null,
    channel: 'sale',
    status: 'draft',
    propertyType: 'flat',
    title: 'Flat for sale',
    slug: 'flat-abc123',
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
    createdAt: new Date('2026-01-01'),
    updatedAt: new Date('2026-01-01'),
    ...overrides,
  }
}

/**
 * `/lister/listings/{id}/edit` — server-side listing load, "manager-only
 * 404" per the API's own object-level authorisation (GetListing throws
 * ForbiddenError for a listing this actor doesn't manage; both that and
 * a genuinely missing listing map to a plain 404, not a 403 that would
 * confirm the listing exists).
 */
describe('/lister/listings/[id]/edit page', () => {
  beforeEach(() => {
    redirectMock.mockReset()
    notFoundMock.mockReset()
    getSessionUserMock.mockReset()
    executeMock.mockReset()
  })

  it('redirects to sign-in when there is no session', async () => {
    getSessionUserMock.mockResolvedValue(null)
    const { default: EditListingPage } =
      await import('@/app/(lister)/lister/listings/[id]/edit/page')

    await EditListingPage({ params: Promise.resolve({ id: 'listing-1' }) })

    expect(redirectMock).toHaveBeenCalledWith(
      '/sign-in?next=%2Flister%2Flistings%2Flisting-1%2Fedit',
    )
  })

  it('404s when the listing does not exist', async () => {
    getSessionUserMock.mockResolvedValue({
      user: { id: 'user-1', role: 'owner' },
    })
    executeMock.mockRejectedValue(new ListingNotFoundError('listing-1'))
    const { default: EditListingPage } =
      await import('@/app/(lister)/lister/listings/[id]/edit/page')

    await EditListingPage({ params: Promise.resolve({ id: 'listing-1' }) })

    expect(notFoundMock).toHaveBeenCalled()
  })

  it('404s (never 403) when the actor does not manage the listing', async () => {
    getSessionUserMock.mockResolvedValue({
      user: { id: 'user-2', role: 'owner' },
    })
    executeMock.mockRejectedValue(
      new ForbiddenError('You do not manage this listing'),
    )
    const { default: EditListingPage } =
      await import('@/app/(lister)/lister/listings/[id]/edit/page')

    await EditListingPage({ params: Promise.resolve({ id: 'listing-1' }) })

    expect(notFoundMock).toHaveBeenCalled()
  })

  it('renders the wizard shell with the loaded listing mapped to form values', async () => {
    getSessionUserMock.mockResolvedValue({
      user: { id: 'user-1', role: 'owner' },
    })
    executeMock.mockResolvedValue(
      listing({
        status: 'rejected',
        channel: 'rent',
        addressLine1: '12 Oxford Road',
      }),
    )
    const { default: EditListingPage } =
      await import('@/app/(lister)/lister/listings/[id]/edit/page')

    const result = await EditListingPage({
      params: Promise.resolve({ id: 'listing-1' }),
    })

    const json = JSON.stringify(result)
    expect(json).toContain('"listingId":"listing-1"')
    expect(json).toContain('"status":"rejected"')
    expect(json).toContain('"addressLine1":"12 Oxford Road"')
    expect(json).toContain('"channel":"rent"')
  })
})
