import { render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'

import { ListingRow } from '@/components/features/listings/dashboard/listing-row'
import type { Listing } from '@/ports/listing-repository'

vi.mock('@/lib/listings-client', async () => {
  const actual = await vi.importActual<typeof import('@/lib/listings-client')>(
    '@/lib/listings-client',
  )
  return { ...actual, changeListingStatus: vi.fn(), deleteListing: vi.fn() }
})

function listing(overrides: Partial<Listing> = {}): Listing {
  return {
    id: 'listing-1',
    listerId: 'user-1',
    agencyId: null,
    channel: 'sale',
    status: 'published',
    propertyType: 'semi_detached',
    title: '3 bed semi-detached house for sale',
    slug: 'flat-abc123',
    description: '',
    features: [],
    bedrooms: 3,
    bathrooms: 1,
    price: 350_000,
    priceQualifier: 'fixed',
    tenure: 'freehold',
    deposit: null,
    furnished: null,
    availableFrom: null,
    epcRating: null,
    councilTaxBand: null,
    newHome: false,
    addressLine1: '12 Oxford Road',
    displayAddress: 'Oxford Road, Reading, RG30',
    town: 'Reading',
    outcode: 'RG30',
    postcode: 'RG30 1AA',
    location: { lat: 51.45, lng: -0.98 },
    locationApproximate: false,
    publishedAt: new Date('2026-01-01'),
    statusChangedAt: new Date('2026-01-01'),
    rejectionReason: null,
    createdAt: new Date('2026-01-01'),
    updatedAt: new Date('2026-01-01'),
    ...overrides,
  }
}

// M1-DESIGN-SPEC.md §4.2: cover thumb, address, one meta line
// (price · channel · property type), status badge, actions.
describe('ListingRow', () => {
  it('shows the display address, one formatted meta line, and the status badge', () => {
    render(
      <ListingRow
        listing={listing()}
        coverBlurhash={null}
        onListingChange={vi.fn()}
        onDeleted={vi.fn()}
      />,
    )

    expect(screen.getByText('Oxford Road, Reading, RG30')).toBeInTheDocument()
    expect(
      screen.getByText('£350,000 · For sale · Semi-detached house'),
    ).toBeInTheDocument()
    expect(screen.getByText('Published')).toBeInTheDocument()
  })

  it('formats a rent listing with pcm and "To rent"', () => {
    render(
      <ListingRow
        listing={listing({
          channel: 'rent',
          price: 1200,
          priceQualifier: 'fixed',
          propertyType: 'flat',
        })}
        coverBlurhash={null}
        onListingChange={vi.fn()}
        onDeleted={vi.fn()}
      />,
    )

    expect(
      screen.getByText('£1,200 pcm · To rent · Flat or apartment'),
    ).toBeInTheDocument()
  })

  it('surfaces the rejection reason inline for a rejected listing', () => {
    render(
      <ListingRow
        listing={listing({
          status: 'rejected',
          rejectionReason: 'Photos are too dark to assess the property.',
        })}
        coverBlurhash={null}
        onListingChange={vi.fn()}
        onDeleted={vi.fn()}
      />,
    )

    expect(
      screen.getByText('Photos are too dark to assess the property.'),
    ).toBeInTheDocument()
  })

  it('renders no rejection banner for a listing that was never rejected', () => {
    render(
      <ListingRow
        listing={listing({ status: 'published', rejectionReason: null })}
        coverBlurhash={null}
        onListingChange={vi.fn()}
        onDeleted={vi.fn()}
      />,
    )

    expect(screen.queryByText(/reason/i)).not.toBeInTheDocument()
  })
})
