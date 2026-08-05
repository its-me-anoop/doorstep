import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { useForm } from 'react-hook-form'
import { afterEach, describe, expect, it, vi } from 'vitest'

const geocodeSearchMock = vi.fn()
vi.mock('@/lib/listings-client', () => ({
  geocodeSearch: (...args: unknown[]) => geocodeSearchMock(...args),
}))

import { Form } from '@/components/ui/form'
import { StepAddress } from '@/components/features/listings/wizard/step-address'
import { useStepValidation } from '@/components/features/listings/wizard/use-step-validation'
import type { ListingFormValues } from '@/lib/listing-wizard-form'

function Harness({
  defaultValues = {},
}: {
  defaultValues?: Partial<ListingFormValues>
} = {}) {
  const form = useForm<ListingFormValues>({
    defaultValues: {
      addressLine1: '',
      displayAddressChoice: 'street',
      displayAddress: '',
      town: '',
      outcode: '',
      postcode: '',
      location: null,
      locationApproximate: false,
      ...defaultValues,
    } as ListingFormValues,
  })
  const validation = useStepValidation(2, form)
  return (
    <Form {...form}>
      <StepAddress form={form} validation={validation} />
    </Form>
  )
}

// M1-DESIGN-SPEC.md §3.2.
describe('StepAddress', () => {
  afterEach(() => {
    vi.clearAllMocks()
  })

  it('happy path: a successful lookup fills town/outcode/location and shows the confirmation line', async () => {
    geocodeSearchMock.mockResolvedValue([
      { lat: 51.45, lng: -0.97, label: 'Reading', outcode: 'RG1' },
    ])
    render(<Harness />)

    fireEvent.change(screen.getByLabelText(/postcode/i), {
      target: { value: 'RG1 1AA' },
    })
    fireEvent.click(screen.getByRole('button', { name: /find address/i }))

    expect(await screen.findByText('Found: Reading, RG1.')).toBeInTheDocument()
    expect(geocodeSearchMock).toHaveBeenCalledWith('RG1 1AA')
  })

  it('unknown postcode: shows the exact spec error and reveals an editable Town fallback', async () => {
    geocodeSearchMock.mockResolvedValue([])
    render(<Harness />)

    fireEvent.change(screen.getByLabelText(/postcode/i), {
      target: { value: 'ZZ99 9ZZ' },
    })
    fireEvent.click(screen.getByRole('button', { name: /find address/i }))

    expect(
      await screen.findByText(
        'We couldn’t find that postcode — check it’s typed correctly, or enter your address manually below.',
      ),
    ).toBeInTheDocument()
    expect(screen.getByLabelText(/^town$/i)).toBeInTheDocument()
  })

  it('the manual Town fallback is not shown before any lookup has been attempted', () => {
    render(<Harness />)
    expect(screen.queryByLabelText(/^town$/i)).not.toBeInTheDocument()
  })

  it('computes the "street name and area only" preview from addressLine1/town/outcode', async () => {
    render(
      <Harness
        defaultValues={{
          addressLine1: '12 Oxford Road',
          town: 'Reading',
          outcode: 'RG30',
          displayAddressChoice: 'street',
        }}
      />,
    )

    await waitFor(() =>
      expect(
        screen.getByText('Shown as: Oxford Road, Reading, RG30.'),
      ).toBeInTheDocument(),
    )
  })

  it('switching to "Full address" recomputes the preview with the house number and full postcode', async () => {
    render(
      <Harness
        defaultValues={{
          addressLine1: '12 Oxford Road',
          town: 'Reading',
          outcode: 'RG30',
          postcode: 'RG30 1AA',
          displayAddressChoice: 'street',
        }}
      />,
    )

    fireEvent.click(screen.getByLabelText(/full address/i))

    await waitFor(() =>
      expect(
        screen.getByText('Shown as: 12 Oxford Road, Reading, RG30 1AA.'),
      ).toBeInTheDocument(),
    )
  })

  it('the approximate-location toggle is off by default and reflects a click', () => {
    render(<Harness />)

    const toggle = screen.getByLabelText(/show an approximate location/i)
    expect(toggle).not.toBeChecked()
    fireEvent.click(toggle)
    expect(toggle).toBeChecked()
  })
})
