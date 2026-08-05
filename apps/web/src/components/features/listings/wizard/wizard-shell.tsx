'use client'

import Link from 'next/link'
import { useRouter, useSearchParams } from 'next/navigation'
import { useForm, useWatch } from 'react-hook-form'

import { Form } from '@/components/ui/form'
import type { PropertyStatus } from '@/domain/enums'
import {
  formValuesToDraftInput,
  type ListingFormValues,
} from '@/lib/listing-wizard-form'
import { patchListing } from '@/lib/listings-client'

import { SaveStatus } from './save-status'
import { StepAddress } from './step-address'
import { StepChannelType } from './step-channel-type'
import { StepDescription } from './step-description'
import { StepDetails } from './step-details'
import { StepIndicator } from './step-indicator'
import { StepPhotos } from './step-photos'
import { StepReview } from './step-review'
import { useAutosave } from './use-autosave'
import { useListingImages } from './use-listing-images'
import { useStepValidation } from './use-step-validation'
import { WizardActionBar } from './wizard-action-bar'
import {
  WIZARD_STEP_COUNT,
  isWizardStepNumber,
  type WizardStepNumber,
} from './wizard-steps'

const STEP_HEADINGS: Record<WizardStepNumber, string> = {
  1: 'What are you listing?',
  2: 'Where is it?',
  3: 'Tell us about the property',
  4: 'Describe the property',
  5: 'Add your photos',
  6: 'Review your listing',
}

function parseStep(raw: string | null): WizardStepNumber {
  const step = Number(raw)
  return isWizardStepNumber(step) ? step : 1
}

interface WizardShellProps {
  listingId: string
  status: PropertyStatus
  initialValues: ListingFormValues
}

/**
 * The create-listing wizard shell (M1-DESIGN-SPEC.md §3): owns the one
 * RHF form spanning steps 1-4, step routing via the `?step=` search
 * param, autosave, and the step chrome (§1.2). Steps 1-4 and 6 are full
 * implementations; step 5 is the spec-consistent placeholder documented
 * on step-photos-placeholder.tsx.
 *
 * Resume behaviour deviation from §3.0: opening `/edit` with no `?step=`
 * always starts at step 1 rather than auto-detecting "the first step
 * with no data yet". That heuristic can't reliably tell a genuinely
 * brand-new draft's server-defaulted placeholder values (channel:
 * 'sale', propertyType: 'other' — required by draftListingSchema even
 * before the user has chosen, see the `/new` route) from a real answer,
 * and the one case that matters for this phase — the create flow's
 * freshly-minted draft — always wants step 1 anyway. Jumping to a
 * specific step still works via `?step=N` (the breadcrumb's completed-
 * step links and Review's Edit links both use exactly that), so nothing
 * is unreachable — this is a documented scope trim, not a missing
 * feature.
 *
 * Images (step 5/photos) live outside the RHF form entirely — they're
 * their own resource with their own endpoints (PRD §6.5 LST-3), not a
 * `draftListingSchema` field — so useListingImages owns that slice of
 * state independently and is loaded once here, shared by StepPhotos (the
 * uploader) and StepReview (the read-only cover/count summary).
 */
export function WizardShell({
  listingId,
  status,
  initialValues,
}: WizardShellProps) {
  const router = useRouter()
  const searchParams = useSearchParams()
  const currentStep = parseStep(searchParams.get('step'))

  const form = useForm<ListingFormValues>({ defaultValues: initialValues })
  const validation = useStepValidation(
    currentStep === 6 ? 4 : (currentStep as 1 | 2 | 3 | 4),
    form,
  )
  const listingImages = useListingImages(listingId)

  // useWatch() with no `name` is typed as DeepPartial — RHF can't prove
  // statically that every key is populated — but `initialValues` always
  // supplies every ListingFormValues key as a real value (never
  // undefined; '' is the "unset" sentinel, see lib/listing-wizard-form.ts),
  // so this is always fully populated at runtime.
  const watchedValues = useWatch({ control: form.control }) as ListingFormValues
  const autosave = useAutosave<ListingFormValues>({
    values: watchedValues,
    onSave: async (values) => {
      await patchListing(listingId, formValuesToDraftInput(values))
    },
  })

  function goToStep(step: WizardStepNumber) {
    router.push(`?step=${step}`)
  }

  function handleContinue() {
    if (currentStep >= 5) return
    if (currentStep <= 4 && !validation.validateStep()) return
    autosave.saveNow()
    goToStep((currentStep + 1) as WizardStepNumber)
  }

  function handleBack() {
    if (currentStep <= 1) return
    autosave.saveNow()
    goToStep((currentStep - 1) as WizardStepNumber)
  }

  return (
    <Form {...form}>
      <div className="mx-auto max-w-[720px] px-5 pt-10 pb-24 sm:px-8 sm:pt-16">
        <div className="flex items-start justify-between gap-4">
          <h1 className="text-muted-foreground text-sm font-medium">
            List your property
          </h1>
          <Link
            href="/lister"
            className="text-muted-foreground text-sm whitespace-nowrap"
          >
            Save and finish later
          </Link>
        </div>

        <div className="mt-6">
          <StepIndicator currentStep={currentStep} />
        </div>

        <div className="mt-8 flex items-start justify-between gap-4">
          <h2 className="text-[length:var(--text-h4)] sm:text-[length:var(--text-h3)]">
            {STEP_HEADINGS[currentStep]}
          </h2>
          <SaveStatus
            status={autosave.status}
            lastSavedAt={autosave.lastSavedAt}
          />
        </div>

        <div className="mt-8" onBlur={() => autosave.saveNow()}>
          {currentStep === 1 && (
            <StepChannelType form={form} validation={validation} />
          )}
          {currentStep === 2 && (
            <StepAddress form={form} validation={validation} />
          )}
          {currentStep === 3 && (
            <StepDetails form={form} validation={validation} />
          )}
          {currentStep === 4 && (
            <StepDescription form={form} validation={validation} />
          )}
          {currentStep === 5 && (
            <StepPhotos
              listingId={listingId}
              images={listingImages.images}
              status={listingImages.status}
              onImageAdded={listingImages.onImageAdded}
              onImagesReplaced={listingImages.onImagesReplaced}
              onImageRemoved={listingImages.onImageRemoved}
            />
          )}
          {currentStep === 6 && (
            <StepReview
              form={form}
              listingId={listingId}
              isRejected={status === 'rejected'}
              onEditStep={goToStep}
              images={listingImages.images}
            />
          )}
        </div>

        {currentStep < WIZARD_STEP_COUNT && (
          <WizardActionBar
            showBack={currentStep > 1}
            onBack={handleBack}
            onContinue={handleContinue}
          />
        )}
      </div>
    </Form>
  )
}
