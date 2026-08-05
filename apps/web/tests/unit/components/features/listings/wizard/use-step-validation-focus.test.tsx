import { act, renderHook } from '@testing-library/react'
import { useForm } from 'react-hook-form'
import { describe, expect, it, vi } from 'vitest'

import { useStepValidation } from '@/components/features/listings/wizard/use-step-validation'
import type { ListingFormValues } from '@/lib/listing-wizard-form'

// M1-DESIGN-SPEC.md §1.1: "Clicking [Continue] while a step is invalid
// ... scrolls to and focuses the first invalid field." `location` and
// `displayAddress` are never directly focusable controls (location is
// set by a successful postcode lookup; displayAddress is derived text),
// so validateStep redirects focus to the control that actually causes
// them, per lib/listing-wizard-form.ts / the address step's own layout.
describe('useStepValidation — focus redirection on an invalid Continue', () => {
  it('focuses the first invalid field in canonical step order, not object key order', () => {
    const setFocus = vi.fn()
    const { result } = renderHook(() => {
      const form = useForm<ListingFormValues>({
        defaultValues: {
          addressLine1: '',
          displayAddress: '',
          town: '',
          outcode: '',
          postcode: '',
          location: null,
        } as ListingFormValues,
      })
      form.setFocus = setFocus
      return useStepValidation(2, form)
    })

    act(() => {
      result.current.validateStep()
    })

    expect(setFocus).toHaveBeenCalledWith('addressLine1')
  })

  it('redirects a missing-location error to the postcode field, which is what actually fixes it', () => {
    const setFocus = vi.fn()
    const { result } = renderHook(() => {
      const form = useForm<ListingFormValues>({
        defaultValues: {
          addressLine1: '12 Oxford Road',
          displayAddress: 'Oxford Road, Reading, RG30',
          town: 'Reading',
          outcode: 'RG30',
          postcode: 'RG30 1AA',
          location: null,
        } as ListingFormValues,
      })
      form.setFocus = setFocus
      return useStepValidation(2, form)
    })

    act(() => {
      result.current.validateStep()
    })

    expect(setFocus).toHaveBeenCalledWith('postcode')
  })
})
