import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { ListingsList } from '@/components/features/listings/dashboard/listings-list'
import { ListingsApiError } from '@/lib/listings-client'
import type { Listing } from '@/ports/listing-repository'

const listMyListingsMock = vi.fn()
vi.mock('@/lib/listings-client', async () => {
  const actual = await vi.importActual<typeof import('@/lib/listings-client')>(
    '@/lib/listings-client',
  )
  return {
    ...actual,
    listMyListings: (...args: unknown[]) => listMyListingsMock(...args),
    changeListingStatus: vi.fn(),
    deleteListing: vi.fn(),
  }
})

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

// M1-DESIGN-SPEC.md §4: cursor pagination ("Load more") over the
// server-rendered first page.
describe('ListingsList', () => {
  beforeEach(() => {
    listMyListingsMock.mockReset()
  })

  it('renders the initial, server-provided page of rows', () => {
    render(
      <ListingsList
        initialListings={[
          listing({ id: 'listing-1', displayAddress: 'Address One' }),
          listing({ id: 'listing-2', displayAddress: 'Address Two' }),
        ]}
        initialNextCursor={null}
        initialCoverBlurhashes={{}}
      />,
    )

    expect(screen.getByText('Address One')).toBeInTheDocument()
    expect(screen.getByText('Address Two')).toBeInTheDocument()
  })

  it('shows no "Load more" button when there is no next page', () => {
    render(
      <ListingsList
        initialListings={[listing()]}
        initialNextCursor={null}
        initialCoverBlurhashes={{}}
      />,
    )

    expect(
      screen.queryByRole('button', { name: 'Load more' }),
    ).not.toBeInTheDocument()
  })

  it('"Load more" fetches the next page with the current cursor and appends it', async () => {
    listMyListingsMock.mockResolvedValue({
      data: [listing({ id: 'listing-2', displayAddress: 'Address Two' })],
      nextCursor: null,
    })
    render(
      <ListingsList
        initialListings={[
          listing({ id: 'listing-1', displayAddress: 'Address One' }),
        ]}
        initialNextCursor="listing-1"
        initialCoverBlurhashes={{}}
      />,
    )

    fireEvent.click(screen.getByRole('button', { name: 'Load more' }))

    expect(listMyListingsMock).toHaveBeenCalledWith({ cursor: 'listing-1' })
    await waitFor(() =>
      expect(screen.getByText('Address Two')).toBeInTheDocument(),
    )
    expect(screen.getByText('Address One')).toBeInTheDocument()
    expect(
      screen.queryByRole('button', { name: 'Load more' }),
    ).not.toBeInTheDocument()
  })

  it('keeps the "Load more" button when another page remains', async () => {
    listMyListingsMock.mockResolvedValue({
      data: [listing({ id: 'listing-2' })],
      nextCursor: 'listing-2',
    })
    render(
      <ListingsList
        initialListings={[listing({ id: 'listing-1' })]}
        initialNextCursor="listing-1"
        initialCoverBlurhashes={{}}
      />,
    )

    fireEvent.click(screen.getByRole('button', { name: 'Load more' }))

    await waitFor(() => expect(listMyListingsMock).toHaveBeenCalledTimes(1))
    expect(
      screen.getByRole('button', { name: 'Load more' }),
    ).toBeInTheDocument()
  })

  it('shows a retryable error when loading more fails, without losing the current rows', async () => {
    listMyListingsMock.mockRejectedValue(
      new ListingsApiError('internal_error', "Couldn't load more."),
    )
    render(
      <ListingsList
        initialListings={[
          listing({ id: 'listing-1', displayAddress: 'Address One' }),
        ]}
        initialNextCursor="listing-1"
        initialCoverBlurhashes={{}}
      />,
    )

    fireEvent.click(screen.getByRole('button', { name: 'Load more' }))

    await waitFor(() =>
      expect(screen.getByText("Couldn't load more.")).toBeInTheDocument(),
    )
    expect(screen.getByText('Address One')).toBeInTheDocument()
    expect(
      screen.getByRole('button', { name: 'Load more' }),
    ).toBeInTheDocument()
  })

  it('removes a row from the list once it is deleted', async () => {
    render(
      <ListingsList
        initialListings={[
          listing({ id: 'listing-1', displayAddress: 'Address One' }),
          listing({ id: 'listing-2', displayAddress: 'Address Two' }),
        ]}
        initialNextCursor={null}
        initialCoverBlurhashes={{}}
      />,
    )

    fireEvent.click(screen.getAllByRole('button', { name: 'Delete draft' })[0]!)
    fireEvent.click(screen.getAllByRole('button', { name: 'Delete' })[0]!)

    await waitFor(() =>
      expect(screen.queryByText('Address One')).not.toBeInTheDocument(),
    )
    expect(screen.getByText('Address Two')).toBeInTheDocument()
  })
})
