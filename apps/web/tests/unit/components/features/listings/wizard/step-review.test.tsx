import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { useForm } from 'react-hook-form'
import { afterEach, describe, expect, it, vi } from 'vitest'

const submitListingMock = vi.fn()
vi.mock('@/lib/listings-client', () => ({
  submitListing: (...args: unknown[]) => submitListingMock(...args),
  ListingsApiError: class ListingsApiError extends Error {
    code: string
    constructor(code: string, message: string) {
      super(message)
      this.code = code
    }
  },
}))

import { Form } from '@/components/ui/form'
import { StepReview } from '@/components/features/listings/wizard/step-review'
import type { ListingImage } from '@/lib/images-client'
import type { ListingFormValues } from '@/lib/listing-wizard-form'

const COMPLETE_SALE: ListingFormValues = {
  channel: 'sale',
  propertyType: 'flat',
  addressLine1: '12 Oxford Road',
  displayAddressChoice: 'street',
  displayAddress: 'Oxford Road, Reading, RG30',
  town: 'Reading',
  outcode: 'RG30',
  postcode: 'RG30 1AA',
  location: { lat: 51.45, lng: -0.97 },
  locationApproximate: false,
  bedrooms: 2,
  bathrooms: 1,
  price: 250_000,
  priceQualifier: 'fixed',
  tenure: 'freehold',
  deposit: '',
  furnished: '',
  availableFrom: '',
  epcRating: '',
  councilTaxBand: '',
  description: 'A lovely two-bed flat.',
  features: ['Garden', 'Garage'],
}

function image(overrides: Partial<ListingImage> = {}): ListingImage {
  return {
    id: 'img-1',
    propertyId: 'listing-1',
    kind: 'photo',
    position: 0,
    width: 400,
    height: 300,
    blurhash: 'LGF5?xYk^6#M@-5c,1J5@[or[Q6.',
    altText: null,
    urls: [{ width: 400, format: 'webp', url: 'https://cdn.test/cover.webp' }],
    ...overrides,
  }
}

function Harness({
  values = COMPLETE_SALE,
  isRejected = false,
  onEditStep = vi.fn(),
  images = [],
}: {
  values?: ListingFormValues
  isRejected?: boolean
  onEditStep?: (step: number) => void
  images?: ListingImage[]
} = {}) {
  const form = useForm<ListingFormValues>({ defaultValues: values })
  return (
    <Form {...form}>
      <StepReview
        form={form}
        listingId="listing-1"
        isRejected={isRejected}
        onEditStep={onEditStep}
        images={images}
      />
    </Form>
  )
}

// M1-DESIGN-SPEC.md §3.6.
describe('StepReview', () => {
  afterEach(() => {
    vi.clearAllMocks()
  })

  it("renders every entered value, grouped under the wizard's own step vocabulary", () => {
    render(<Harness />)

    expect(screen.getByText('Channel & type')).toBeInTheDocument()
    expect(screen.getByText('For sale')).toBeInTheDocument()
    expect(screen.getByText('Flat or apartment')).toBeInTheDocument()

    expect(screen.getByText('Address')).toBeInTheDocument()
    expect(screen.getByText('Oxford Road, Reading, RG30')).toBeInTheDocument()

    expect(screen.getByText('Details')).toBeInTheDocument()
    expect(screen.getByText('£250,000')).toBeInTheDocument()
    expect(screen.getByText('Freehold')).toBeInTheDocument()

    expect(screen.getByText('Description & features')).toBeInTheDocument()
    expect(screen.getByText('A lovely two-bed flat.')).toBeInTheDocument()
    expect(screen.getByText('Garden, Garage')).toBeInTheDocument()

    expect(screen.getByText('Photos')).toBeInTheDocument()
  })

  it('an Edit link jumps back to the right step', () => {
    const onEditStep = vi.fn()
    render(<Harness onEditStep={onEditStep} />)

    fireEvent.click(screen.getAllByRole('button', { name: 'Edit' })[1])
    expect(onEditStep).toHaveBeenCalledWith(2)
  })

  it('the Photos section says "No photos added yet" with no cover thumbnail when empty', () => {
    render(<Harness images={[]} />)

    expect(screen.getByText('No photos added yet')).toBeInTheDocument()
    expect(screen.queryByAltText('Cover photo')).not.toBeInTheDocument()
  })

  it('the Photos section shows the count and the position-0 image as the cover thumbnail', () => {
    render(
      <Harness
        images={[
          image({ id: 'img-2', position: 1 }),
          image({ id: 'img-1', position: 0 }),
        ]}
      />,
    )

    expect(screen.getByText('2 photos added')).toBeInTheDocument()
    expect(screen.getByAltText('Cover photo')).toHaveAttribute(
      'src',
      'https://cdn.test/cover.webp',
    )
  })

  it('ignores floorplan/epc images when counting photos', () => {
    render(
      <Harness
        images={[
          image({ id: 'img-1', kind: 'photo', position: 0 }),
          image({ id: 'img-2', kind: 'floorplan', position: 1 }),
        ]}
      />,
    )

    expect(screen.getByText('1 photo added')).toBeInTheDocument()
  })

  it('the Photos section’s Edit link jumps to step 5', () => {
    const onEditStep = vi.fn()
    render(<Harness onEditStep={onEditStep} />)

    fireEvent.click(screen.getAllByRole('button', { name: 'Edit' })[4])
    expect(onEditStep).toHaveBeenCalledWith(5)
  })

  it('shows a fix-it rollup when a required field is missing, with no rollup item for photos', () => {
    render(<Harness values={{ ...COMPLETE_SALE, tenure: '' }} />)

    expect(
      screen.getByText('There’s something to fix before you can submit:'),
    ).toBeInTheDocument()
    expect(
      screen.getByText('Tenure is required for sale listings.'),
    ).toBeInTheDocument()
  })

  it('shows no rollup when every wizard-covered field is complete', () => {
    render(<Harness />)
    expect(
      screen.queryByText('There’s something to fix before you can submit:'),
    ).not.toBeInTheDocument()
  })

  it('"Submit for approval" calls submitListing(id) and shows the in-place confirmation on success', async () => {
    submitListingMock.mockResolvedValue({
      id: 'listing-1',
      status: 'pending_review',
      displayAddress: 'Oxford Road, Reading, RG30',
    })
    render(<Harness />)

    fireEvent.click(screen.getByRole('button', { name: 'Submit for approval' }))

    await waitFor(() =>
      expect(submitListingMock).toHaveBeenCalledWith('listing-1'),
    )
    expect(
      await screen.findByText(
        'You’re all set — Oxford Road, Reading, RG30 is in for review.',
      ),
    ).toBeInTheDocument()
    expect(
      screen.getByRole('button', { name: 'Back to your listings' }),
    ).toHaveAttribute('href', '/lister')
  })

  it('relabels the button "Resubmit for approval" for a rejected listing', () => {
    render(<Harness isRejected />)
    expect(
      screen.getByRole('button', { name: 'Resubmit for approval' }),
    ).toBeInTheDocument()
  })

  it('shows the server error inline and stays on the review content when submit fails', async () => {
    const { ListingsApiError } = await import('@/lib/listings-client')
    submitListingMock.mockRejectedValue(
      new ListingsApiError(
        'listing_incomplete',
        'Add at least 1 photo before submitting.',
      ),
    )
    render(<Harness />)

    fireEvent.click(screen.getByRole('button', { name: 'Submit for approval' }))

    expect(
      await screen.findByText('Add at least 1 photo before submitting.'),
    ).toBeInTheDocument()
    expect(screen.queryByText(/is in for review/i)).not.toBeInTheDocument()
  })
})
