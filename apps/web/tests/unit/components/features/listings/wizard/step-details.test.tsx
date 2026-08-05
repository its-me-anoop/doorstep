import { fireEvent, render, screen } from '@testing-library/react'
import { useForm } from 'react-hook-form'
import { describe, expect, it } from 'vitest'

import { Form } from '@/components/ui/form'
import { StepDetails } from '@/components/features/listings/wizard/step-details'
import { useStepValidation } from '@/components/features/listings/wizard/use-step-validation'
import type { ListingFormValues } from '@/lib/listing-wizard-form'

const BASE_VALUES: Partial<ListingFormValues> = {
  bedrooms: '',
  bathrooms: '',
  price: '',
  priceQualifier: '',
  tenure: '',
  deposit: '',
  furnished: '',
  availableFrom: '',
  epcRating: '',
  councilTaxBand: '',
}

function Harness({
  defaultValues,
}: {
  defaultValues: Partial<ListingFormValues>
}) {
  const form = useForm<ListingFormValues>({
    defaultValues: { ...BASE_VALUES, ...defaultValues } as ListingFormValues,
  })
  const validation = useStepValidation(3, form)
  return (
    <Form {...form}>
      {/* Test-only control: real channel selection lives on step 1 — this
          harness stands in for the wizard shell's shared form re-driving
          `channel` live, to prove StepDetails reacts to it. */}
      <button
        type="button"
        onClick={() =>
          form.setValue(
            'channel',
            form.getValues('channel') === 'sale' ? 'rent' : 'sale',
          )
        }
      >
        toggle channel
      </button>
      <StepDetails form={form} validation={validation} />
    </Form>
  )
}

// M1-DESIGN-SPEC.md §3.3 — the channel-conditional fieldset swap is the
// single most important behaviour on this step.
describe('StepDetails', () => {
  it('always shows bedrooms and bathrooms, with "Studio" for 0 bedrooms', () => {
    render(<Harness defaultValues={{ channel: 'sale' }} />)

    const bedrooms = screen.getByLabelText(/bedrooms/i)
    expect(
      Array.from(bedrooms.querySelectorAll('option')).map((o) => o.textContent),
    ).toEqual(['Select…', 'Studio', '1', '2', '3', '4', '5', '6+'])

    const bathrooms = screen.getByLabelText(/bathrooms/i)
    expect(
      Array.from(bathrooms.querySelectorAll('option')).map(
        (o) => o.textContent,
      ),
    ).toEqual(['Select…', '1', '2', '3', '4+'])
  })

  it('sale channel: shows Sale details (price, price qualifier, tenure), no rental fields', () => {
    render(<Harness defaultValues={{ channel: 'sale' }} />)

    expect(screen.getByText('Sale details')).toBeInTheDocument()
    expect(screen.getByLabelText(/^price$/i)).toBeInTheDocument()
    expect(screen.getByLabelText(/price qualifier/i)).toBeInTheDocument()
    expect(screen.getByLabelText(/tenure/i)).toBeInTheDocument()

    expect(screen.queryByText('Rental details')).not.toBeInTheDocument()
    expect(screen.queryByLabelText(/^rent$/i)).not.toBeInTheDocument()
    expect(screen.queryByLabelText(/furnished/i)).not.toBeInTheDocument()
    expect(screen.queryByLabelText(/available from/i)).not.toBeInTheDocument()
  })

  it('sale channel: EPC rating appears at the end, labelled optional', () => {
    render(<Harness defaultValues={{ channel: 'sale' }} />)
    expect(
      screen.getByLabelText(/epc rating \(optional\)/i),
    ).toBeInTheDocument()
  })

  it('rent channel: shows Rental details (rent, furnished, available from, deposit, required EPC rating), no sale fields', () => {
    render(<Harness defaultValues={{ channel: 'rent' }} />)

    expect(screen.getByText('Rental details')).toBeInTheDocument()
    expect(screen.getByLabelText(/^rent$/i)).toBeInTheDocument()
    expect(screen.getByLabelText(/furnished/i)).toBeInTheDocument()
    expect(screen.getByLabelText(/available from/i)).toBeInTheDocument()
    expect(screen.getByLabelText(/deposit/i)).toBeInTheDocument()
    // The required rent-channel EPC rating — not the sale-only "(optional)" one.
    expect(screen.getByLabelText(/^epc rating$/i)).toBeInTheDocument()
    expect(
      screen.queryByLabelText(/epc rating \(optional\)/i),
    ).not.toBeInTheDocument()

    expect(screen.queryByText('Sale details')).not.toBeInTheDocument()
    expect(screen.queryByLabelText(/^price$/i)).not.toBeInTheDocument()
    expect(screen.queryByLabelText(/price qualifier/i)).not.toBeInTheDocument()
    expect(screen.queryByLabelText(/^tenure$/i)).not.toBeInTheDocument()
  })

  it('council tax band is shown for both channels, always optional', () => {
    const { rerender } = render(<Harness defaultValues={{ channel: 'sale' }} />)
    expect(screen.getByLabelText(/council tax band/i)).toBeInTheDocument()

    rerender(<Harness defaultValues={{ channel: 'rent' }} />)
    expect(screen.getByLabelText(/council tax band/i)).toBeInTheDocument()
  })

  it('rent channel: clicking "Now" sets Available from to today', () => {
    render(<Harness defaultValues={{ channel: 'rent' }} />)

    const today = new Date().toISOString().slice(0, 10)
    fireEvent.click(screen.getByRole('button', { name: 'Now' }))

    expect(screen.getByLabelText(/available from/i)).toHaveValue(today)
  })

  it('reacts live to a channel change: rent -> sale swaps the fieldset', () => {
    render(<Harness defaultValues={{ channel: 'rent' }} />)
    expect(screen.getByText('Rental details')).toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: 'toggle channel' }))

    expect(screen.getByText('Sale details')).toBeInTheDocument()
    expect(screen.queryByText('Rental details')).not.toBeInTheDocument()
  })

  it('switching to rent silently sets priceQualifier to "fixed" (never shown to the user for rent)', () => {
    render(
      <Harness
        defaultValues={{ channel: 'sale', priceQualifier: 'guide_price' }}
      />,
    )

    fireEvent.click(screen.getByRole('button', { name: 'toggle channel' }))

    expect(screen.queryByLabelText(/price qualifier/i)).not.toBeInTheDocument()
  })
})
