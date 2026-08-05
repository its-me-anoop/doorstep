import { useCallback } from 'react'
import type { UseFormReturn } from 'react-hook-form'

import {
  validateWizardStep,
  WIZARD_STEP_FIELDS,
  type WizardStep,
} from '@/lib/validation/listing-wizard'
import type { ListingFormValues } from '@/lib/listing-wizard-form'

/**
 * Two step-2 fields can never themselves take focus: `location` is set
 * only by a successful postcode lookup (M1-DESIGN-SPEC.md §3.2), and
 * `displayAddress` is derived text, never a direct input
 * (lib/listing-wizard-form.ts). Redirect focus to the control that
 * actually resolves each — the postcode field re-triggers the lookup;
 * addressLine1 is what displayAddress is computed from.
 */
const FOCUS_REDIRECTS: Partial<Record<string, string>> = {
  location: 'postcode',
  displayAddress: 'addressLine1',
}

/**
 * Wires lib/validation/listing-wizard.ts's step-scoped schema reuse into
 * RHF's own `formState.errors` (via `setError`/`clearErrors`), so the
 * wizard's shared `<FormField>`/`<FormMessage>` primitives — already
 * wired to `formState.errors` regardless of *how* an error got there —
 * display these errors with zero extra plumbing per step
 * (M1-DESIGN-SPEC.md §1.1).
 *
 * Two entry points, matching the spec's two validation moments:
 * `validateField` for a single blurred field, `validateStep` for the
 * Continue click (which also fires for every field in the step, so a
 * user who tabs straight through without triggering individual blurs
 * still sees every problem at once).
 */
export function useStepValidation(
  step: WizardStep,
  form: UseFormReturn<ListingFormValues>,
) {
  const { setError, clearErrors, getValues, setFocus } = form

  const validateField = useCallback(
    (field: string) => {
      const { fieldErrors } = validateWizardStep(
        step,
        getValues() as unknown as Record<string, unknown>,
      )
      const message = fieldErrors[field]
      if (message) {
        setError(field as keyof ListingFormValues, { type: 'manual', message })
      } else {
        clearErrors(field as keyof ListingFormValues)
      }
    },
    [step, getValues, setError, clearErrors],
  )

  const validateStep = useCallback((): boolean => {
    const { valid, fieldErrors } = validateWizardStep(
      step,
      getValues() as unknown as Record<string, unknown>,
    )

    if (valid) {
      clearErrors()
      return true
    }

    for (const [field, message] of Object.entries(fieldErrors)) {
      if (message) {
        setError(field as keyof ListingFormValues, { type: 'manual', message })
      }
    }

    const firstInvalidField = WIZARD_STEP_FIELDS[step].find(
      (field) => fieldErrors[field],
    )
    if (firstInvalidField) {
      const focusTarget =
        FOCUS_REDIRECTS[firstInvalidField] ?? firstInvalidField
      setFocus(focusTarget as keyof ListingFormValues)
    }

    return false
  }, [step, getValues, setError, clearErrors, setFocus])

  return { validateField, validateStep }
}
