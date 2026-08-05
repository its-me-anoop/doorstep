import { fireEvent, render, screen } from '@testing-library/react'
import { useForm } from 'react-hook-form'
import { describe, expect, it } from 'vitest'

import { Form } from '@/components/ui/form'
import { StepChannelType } from '@/components/features/listings/wizard/step-channel-type'
import { useStepValidation } from '@/components/features/listings/wizard/use-step-validation'
import type { ListingFormValues } from '@/lib/listing-wizard-form'

function Harness({ channel = 'sale' as 'sale' | 'rent' | '' } = {}) {
  const form = useForm<ListingFormValues>({
    defaultValues: { channel, propertyType: '' } as ListingFormValues,
  })
  const validation = useStepValidation(1, form)
  return (
    <Form {...form}>
      <StepChannelType form={form} validation={validation} />
    </Form>
  )
}

// M1-DESIGN-SPEC.md §3.1.
describe('StepChannelType', () => {
  it('renders the two channel tiles and the property type select with spec-exact labels', () => {
    render(<Harness />)

    expect(screen.getByRole('button', { name: 'For sale' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'To rent' })).toBeInTheDocument()

    const select = screen.getByLabelText(/property type/i)
    const options = Array.from(select.querySelectorAll('option')).map(
      (option) => option.textContent,
    )
    expect(options).toEqual([
      'Select a property type…',
      'Detached house',
      'Semi-detached house',
      'Terraced house',
      'Flat or apartment',
      'Bungalow',
      'Maisonette',
      'Land',
      'Other',
    ])
  })

  it('marks the currently-selected channel tile as pressed', () => {
    render(<Harness channel="sale" />)

    expect(screen.getByRole('button', { name: 'For sale' })).toHaveAttribute(
      'aria-pressed',
      'true',
    )
    expect(screen.getByRole('button', { name: 'To rent' })).toHaveAttribute(
      'aria-pressed',
      'false',
    )
  })

  it('clicking a tile switches the selected channel', () => {
    render(<Harness channel="sale" />)

    fireEvent.click(screen.getByRole('button', { name: 'To rent' }))

    expect(screen.getByRole('button', { name: 'To rent' })).toHaveAttribute(
      'aria-pressed',
      'true',
    )
    expect(screen.getByRole('button', { name: 'For sale' })).toHaveAttribute(
      'aria-pressed',
      'false',
    )
  })
})
