import { inspect } from 'node:util'

import { describe, expect, it, vi, beforeEach } from 'vitest'

import type { Listing } from '@/ports/listing-repository'

// Base UI's Button wraps its rendered element in structures that contain
// circular references (ref forwarding), so JSON.stringify throws on the
// resolved tree — node:util's inspect handles cycles gracefully instead
// (same approach as tests/unit/app/account/page.test.tsx).
function serialise(node: unknown): string {
  return inspect(node, { depth: 14, breakLength: Infinity })
}

const redirectMock = vi.fn()
vi.mock('next/navigation', () => ({
  redirect: (path: string) => redirectMock(path),
}))

const getSessionUserMock = vi.fn()
vi.mock('@/lib/session', () => ({
  getSessionUser: () => getSessionUserMock(),
}))

const listMyListingsExecuteMock = vi.fn()
const getCoverBlurhashesExecuteMock = vi.fn()
vi.mock('@/lib/composition', () => ({
  createServices: () => ({
    listings: { listMyListings: { execute: listMyListingsExecuteMock } },
    images: { getCoverBlurhashes: { execute: getCoverBlurhashesExecuteMock } },
  }),
}))

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
    bedrooms: 2,
    bathrooms: 1,
    price: 250_000,
    priceQualifier: 'guide_price',
    tenure: 'freehold',
    deposit: null,
    furnished: null,
    availableFrom: null,
    epcRating: null,
    councilTaxBand: null,
    newHome: false,
    addressLine1: '12 Oxford Road',
    displayAddress: '12 Oxford Road, Reading',
    town: 'Reading',
    outcode: 'RG30',
    postcode: 'RG30 1AA',
    location: { lat: 51.45, lng: -0.98 },
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
 * `/lister` — the M1-DESIGN-SPEC.md §4 my-listings dashboard. The layout
 * (app/(lister)/layout.tsx) already handles the two-tier role gate; this
 * page's own getSessionUser() re-check mirrors the edit-listing page's
 * same defence-in-depth precedent (tests/unit/app/lister/listings/[id]/
 * edit/page.test.tsx).
 */
describe('/lister dashboard page', () => {
  beforeEach(() => {
    redirectMock.mockReset()
    getSessionUserMock.mockReset()
    listMyListingsExecuteMock.mockReset()
    getCoverBlurhashesExecuteMock.mockReset()
    getCoverBlurhashesExecuteMock.mockResolvedValue(new Map())
  })

  it('redirects to sign-in when there is no session', async () => {
    getSessionUserMock.mockResolvedValue(null)
    const { default: ListerPage } = await import('@/app/(lister)/lister/page')

    await ListerPage()

    expect(redirectMock).toHaveBeenCalledWith('/sign-in?next=%2Flister')
    expect(listMyListingsExecuteMock).not.toHaveBeenCalled()
  })

  it('fetches the actor’s first page of listings and their cover blurhashes', async () => {
    getSessionUserMock.mockResolvedValue({
      user: { id: 'user-1', role: 'owner' },
    })
    listMyListingsExecuteMock.mockResolvedValue({
      data: [listing({ id: 'listing-1' }), listing({ id: 'listing-2' })],
      nextCursor: 'listing-2',
    })
    getCoverBlurhashesExecuteMock.mockResolvedValue(
      new Map([['listing-1', 'LGF5?xYk^6#M@-5c,1J5@[or[Q6.']]),
    )
    const { default: ListerPage } = await import('@/app/(lister)/lister/page')

    const result = await ListerPage()

    expect(listMyListingsExecuteMock).toHaveBeenCalledWith(
      { id: 'user-1', role: 'owner' },
      {},
    )
    expect(getCoverBlurhashesExecuteMock).toHaveBeenCalledWith([
      'listing-1',
      'listing-2',
    ])
    const serialised = serialise(result)
    expect(serialised).toContain("initialNextCursor: 'listing-2'")
    expect(serialised).toContain("'listing-1': 'LGF5?xYk^6#M@-5c,1J5@[or[Q6.'")
  })

  it('shows the teaching empty state when the actor has no listings yet', async () => {
    getSessionUserMock.mockResolvedValue({
      user: { id: 'user-1', role: 'owner' },
    })
    listMyListingsExecuteMock.mockResolvedValue({ data: [], nextCursor: null })
    const { default: ListerPage } = await import('@/app/(lister)/lister/page')

    const result = await ListerPage()

    const serialised = serialise(result)
    expect(serialised).toContain('List your first property')
    expect(serialised).toContain('/lister/listings/new')
    expect(getCoverBlurhashesExecuteMock).toHaveBeenCalledWith([])
  })

  it('always shows the header "Add a listing" button, whether or not there are listings', async () => {
    getSessionUserMock.mockResolvedValue({
      user: { id: 'user-1', role: 'owner' },
    })
    listMyListingsExecuteMock.mockResolvedValue({
      data: [listing()],
      nextCursor: null,
    })
    const { default: ListerPage } = await import('@/app/(lister)/lister/page')

    const result = await ListerPage()

    const serialised = serialise(result)
    expect(serialised).toContain('Your listings')
    expect(serialised).toContain('Add a listing')
  })
})
