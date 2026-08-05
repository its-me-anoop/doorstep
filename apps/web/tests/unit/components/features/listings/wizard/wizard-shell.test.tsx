import { act, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

let searchParamsStub = new URLSearchParams()
const pushMock = vi.fn()
vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: pushMock }),
  useSearchParams: () => searchParamsStub,
}))

const patchListingMock = vi.fn().mockResolvedValue({})
vi.mock('@/lib/listings-client', () => ({
  patchListing: (...args: unknown[]) => patchListingMock(...args),
  submitListing: vi.fn(),
  geocodeSearch: vi.fn().mockResolvedValue([]),
  ListingsApiError: class ListingsApiError extends Error {
    code: string
    constructor(code: string, message: string) {
      super(message)
      this.code = code
    }
  },
}))

const listListingImagesMock = vi.fn().mockResolvedValue([])
vi.mock('@/lib/images-client', () => ({
  listListingImages: (...args: unknown[]) => listListingImagesMock(...args),
}))

import { WizardShell } from '@/components/features/listings/wizard/wizard-shell'
import { listingToFormValues } from '@/lib/listing-wizard-form'
import type { Listing } from '@/ports/listing-repository'

function freshDraft(overrides: Partial<Listing> = {}): Listing {
  return {
    id: 'listing-1',
    listerId: 'user-1',
    agencyId: null,
    channel: 'sale',
    status: 'draft',
    propertyType: 'other',
    title: 'Property for sale',
    slug: 'property-abc123',
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

function renderShell(listing: Listing, step?: string) {
  searchParamsStub = new URLSearchParams(step ? { step } : {})
  return render(
    <WizardShell
      listingId={listing.id}
      status={listing.status}
      initialValues={listingToFormValues(listing)}
    />,
  )
}

// M1-DESIGN-SPEC.md §3.
describe('WizardShell', () => {
  beforeEach(() => {
    vi.useFakeTimers({ shouldAdvanceTime: true })
  })

  afterEach(() => {
    vi.clearAllMocks()
    vi.useRealTimers()
  })

  it('defaults to step 1 and shows the quiet page title + escape hatch', () => {
    renderShell(freshDraft())

    expect(screen.getByText('List your property')).toBeInTheDocument()
    expect(
      screen.getByRole('link', { name: 'Save and finish later' }),
    ).toHaveAttribute('href', '/lister')
    expect(screen.getByText('What are you listing?')).toBeInTheDocument()
  })

  it('reads the step from the URL', () => {
    renderShell(freshDraft({ channel: 'sale' }), '3')
    expect(screen.getByText('Tell us about the property')).toBeInTheDocument()
  })

  it('Continue on an incomplete step (empty address) does not navigate', () => {
    // A freshly-created draft always has a real channel/propertyType
    // (CreateListingDraft's own required defaults — step 1 can never
    // actually be "blank" for a persisted listing), but its address is
    // genuinely empty until the wizard's own step 2 fills it in.
    renderShell(freshDraft(), '2')

    fireEvent.click(screen.getByRole('button', { name: 'Continue' }))

    expect(pushMock).not.toHaveBeenCalledWith('?step=3')
  })

  it('Continue on a valid step advances to the next step and autosaves', async () => {
    renderShell(freshDraft({ channel: 'sale', propertyType: 'flat' }))

    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Continue' }))
    })

    expect(pushMock).toHaveBeenCalledWith('?step=2')
    await waitFor(() =>
      expect(patchListingMock).toHaveBeenCalledWith(
        'listing-1',
        expect.objectContaining({ channel: 'sale', propertyType: 'flat' }),
      ),
    )
  })

  it('Back navigates to the previous step', () => {
    renderShell(freshDraft(), '2')

    fireEvent.click(screen.getByRole('button', { name: 'Back' }))

    expect(pushMock).toHaveBeenCalledWith('?step=1')
  })

  it('step 1 has no Back button (nothing to go back to)', () => {
    renderShell(freshDraft())
    expect(
      screen.queryByRole('button', { name: 'Back' }),
    ).not.toBeInTheDocument()
  })

  it('autosaves 3s after the user stops typing, with channel/propertyType always in the payload', async () => {
    renderShell(freshDraft({ channel: 'sale', propertyType: 'flat' }))

    fireEvent.change(screen.getByLabelText(/property type/i), {
      target: { value: 'terraced' },
    })

    await act(async () => {
      vi.advanceTimersByTime(3000)
    })

    await waitFor(() =>
      expect(patchListingMock).toHaveBeenCalledWith(
        'listing-1',
        expect.objectContaining({ channel: 'sale', propertyType: 'terraced' }),
      ),
    )
  })

  it('step 6 renders the review step, labelled "Resubmit for approval" for a rejected listing', () => {
    renderShell(freshDraft({ status: 'rejected' }), '6')
    expect(
      screen.getByRole('button', { name: 'Resubmit for approval' }),
    ).toBeInTheDocument()
  })

  it('step 6 has no shared Continue/Back action bar (review owns its own submit)', () => {
    renderShell(freshDraft(), '6')
    expect(
      screen.queryByRole('button', { name: 'Continue' }),
    ).not.toBeInTheDocument()
  })

  it('step 5 loads and renders the wizard photo step', async () => {
    renderShell(freshDraft(), '5')

    expect(
      await screen.findByRole('heading', { name: 'Photos' }),
    ).toBeInTheDocument()
    expect(listListingImagesMock).toHaveBeenCalledWith('listing-1')
  })

  it('step 6 review shows the photo count loaded by useListingImages', async () => {
    listListingImagesMock.mockResolvedValueOnce([
      {
        id: 'img-1',
        propertyId: 'listing-1',
        kind: 'photo',
        position: 0,
        width: 400,
        height: 300,
        blurhash: 'LGF5?xYk^6#M@-5c,1J5@[or[Q6.',
        altText: null,
        urls: [],
      },
    ])
    renderShell(freshDraft(), '6')

    expect(await screen.findByText('1 photo added')).toBeInTheDocument()
  })
})
