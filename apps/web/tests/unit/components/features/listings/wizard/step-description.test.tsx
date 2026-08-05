import { fireEvent, render, screen } from '@testing-library/react'
import { useForm } from 'react-hook-form'
import { describe, expect, it } from 'vitest'

import { Form } from '@/components/ui/form'
import { StepDescription } from '@/components/features/listings/wizard/step-description'
import { useStepValidation } from '@/components/features/listings/wizard/use-step-validation'
import type { ListingFormValues } from '@/lib/listing-wizard-form'

function Harness({
  defaultValues = {},
}: {
  defaultValues?: Partial<ListingFormValues>
} = {}) {
  const form = useForm<ListingFormValues>({
    defaultValues: {
      description: '',
      features: [],
      ...defaultValues,
    } as ListingFormValues,
  })
  const validation = useStepValidation(4, form)
  return (
    <Form {...form}>
      <StepDescription form={form} validation={validation} />
    </Form>
  )
}

// M1-DESIGN-SPEC.md §3.4.
describe('StepDescription', () => {
  it('renders the description textarea (with its helper copy) and the "Key features (up to 10)" chip input', () => {
    render(<Harness />)

    expect(screen.getByLabelText(/^description$/i)).toBeInTheDocument()
    expect(
      screen.getByText(/describe the property in your own words/i),
    ).toBeInTheDocument()
    expect(screen.getByText('Key features (up to 10)')).toBeInTheDocument()
  })

  it('shows a comma-formatted character counter that updates as the user types', () => {
    render(<Harness />)

    const textarea = screen.getByRole('textbox', { name: /description/i })
    expect(screen.getByText('0 / 2,000')).toBeInTheDocument()

    fireEvent.change(textarea, { target: { value: 'A lovely home.' } })
    expect(screen.getByText('14 / 2,000')).toBeInTheDocument()
  })

  it('adding a feature via the chip input updates the shared form state', () => {
    render(<Harness />)

    fireEvent.click(screen.getByRole('button', { name: 'Garden' }))

    expect(screen.getByText('1 of 10 features added.')).toBeInTheDocument()
  })
})
