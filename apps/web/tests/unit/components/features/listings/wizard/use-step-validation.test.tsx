import { act, renderHook } from '@testing-library/react'
import { useForm } from 'react-hook-form'
import { describe, expect, it } from 'vitest'

import { useStepValidation } from '@/components/features/listings/wizard/use-step-validation'
import type { ListingFormValues } from '@/lib/listing-wizard-form'

function setup(defaultValues: Partial<ListingFormValues>, step: 1 | 2 | 3 | 4) {
  return renderHook(() => {
    const form = useForm<ListingFormValues>({
      defaultValues: defaultValues as ListingFormValues,
    })
    const validation = useStepValidation(step, form)
    // RHF's formState is a read-tracking proxy: a value only propagates
    // to renderHook's `result.current` once something reads it during
    // render, which is what this line is for (matches RHF's own
    // testing-recipe pattern for asserting on `formState.errors`).
    return { form, validation, errors: form.formState.errors }
  })
}

// M1-DESIGN-SPEC.md §1.1: "Continue is never disabled. Clicking it while
// a step is invalid triggers validation display ... and does not
// advance." + "Field-level validation fires on blur."
describe('useStepValidation', () => {
  it('validateStep() returns true and sets no errors when the step is complete', () => {
    const { result } = setup({ channel: 'sale', propertyType: 'flat' }, 1)

    let valid = false
    act(() => {
      valid = result.current.validation.validateStep()
    })

    expect(valid).toBe(true)
    expect(result.current.errors).toEqual({})
  })

  it('validateStep() returns false and sets a field error when required data is missing', () => {
    const { result } = setup({ channel: '', propertyType: '' }, 1)

    let valid = true
    act(() => {
      valid = result.current.validation.validateStep()
    })

    expect(valid).toBe(false)
    expect(result.current.errors.channel?.message).toBe(
      'Choose for sale or to rent.',
    )
  })

  it('validateField() only ever sets/clears the one field it checks', () => {
    const { result } = setup({ channel: '', propertyType: 'flat' }, 1)

    act(() => {
      result.current.validation.validateField('propertyType')
    })
    expect(result.current.errors.propertyType).toBeUndefined()
    expect(result.current.errors.channel).toBeUndefined()
  })

  it('a subsequent valid validateField() clears a previously-set error', () => {
    const { result, rerender } = setup({ channel: '', propertyType: 'flat' }, 1)

    act(() => {
      result.current.validation.validateField('channel')
    })
    expect(result.current.errors.channel).toBeDefined()

    act(() => {
      result.current.form.setValue('channel', 'sale')
    })
    rerender()
    act(() => {
      result.current.validation.validateField('channel')
    })
    expect(result.current.errors.channel).toBeUndefined()
  })

  it('step 3 correctly requires tenure only for a sale listing (channel-conditional, reused from submitListingSchema)', () => {
    const { result } = setup(
      {
        channel: 'sale',
        bedrooms: 2,
        bathrooms: 1,
        price: 250_000,
        priceQualifier: 'fixed',
        tenure: '',
        epcRating: '',
      },
      3,
    )

    let valid = true
    act(() => {
      valid = result.current.validation.validateStep()
    })

    expect(valid).toBe(false)
    expect(result.current.errors.tenure?.message).toBe(
      'Tenure is required for sale listings.',
    )
    expect(result.current.errors.epcRating).toBeUndefined()
  })
})
