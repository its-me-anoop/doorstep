'use client'

import { useState } from 'react'
import Link from 'next/link'
import { Check } from 'lucide-react'
import type { UseFormReturn } from 'react-hook-form'

import { Button } from '@/components/ui/button'
import { formatPrice } from '@/domain/money'
import type { ListingImage } from '@/lib/images-client'
import { ListingsApiError, submitListing } from '@/lib/listings-client'
import type { ListingFormValues } from '@/lib/listing-wizard-form'
import { validateWizardStep } from '@/lib/validation/listing-wizard'

import { WIZARD_STEP_LABELS, type WizardStepNumber } from './wizard-steps'
import {
  FURNISHED_LABELS,
  PROPERTY_TYPE_LABELS,
  TENURE_LABELS,
} from './wizard-labels'

const EDITABLE_STEPS = [1, 2, 3, 4] as const

interface SummaryGroupProps {
  step: Exclude<WizardStepNumber, 6>
  onEditStep: (step: WizardStepNumber) => void
  children: React.ReactNode
}

/** The group heading reuses WIZARD_STEP_LABELS — "what you see on
 * Review is what you typed, labelled the same way" (§3.6) applies to
 * the step names themselves too, not just the field values. */
function SummaryGroup({ step, onEditStep, children }: SummaryGroupProps) {
  return (
    <section className="flex flex-col gap-3">
      <div className="flex items-center justify-between">
        <h3 className="text-[length:var(--text-h4)]">
          {WIZARD_STEP_LABELS[step]}
        </h3>
        <button
          type="button"
          onClick={() => onEditStep(step)}
          className="text-primary text-sm"
        >
          Edit
        </button>
      </div>
      <dl className="flex flex-col gap-2">{children}</dl>
    </section>
  )
}

function Row({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div>
      <dt className="text-muted-foreground text-sm">{label}</dt>
      <dd className="text-foreground mt-0.5 text-base">{value}</dd>
    </div>
  )
}

function bedroomsLabel(bedrooms: ListingFormValues['bedrooms']): string {
  if (bedrooms === '') return '—'
  return bedrooms === 0
    ? 'Studio'
    : `${bedrooms} bedroom${bedrooms === 1 ? '' : 's'}`
}

interface StepReviewProps {
  form: UseFormReturn<ListingFormValues>
  listingId: string
  isRejected: boolean
  onEditStep: (step: WizardStepNumber) => void
  /** Every image the wizard currently knows about (all kinds) — sourced
   * from wizard-shell.tsx's useListingImages, the same list StepPhotos
   * itself renders from. Defaults to empty so existing callers/tests that
   * pre-date the photo step keep working unchanged. */
  images?: ListingImage[]
}

/** M1-DESIGN-SPEC.md §3.6: the read-only summary, the fix-it rollup, and
 * the in-place post-submit confirmation. */
export function StepReview({
  form,
  listingId,
  isRejected,
  onEditStep,
  images = [],
}: StepReviewProps) {
  const [submitting, setSubmitting] = useState(false)
  const [submitError, setSubmitError] = useState<string | null>(null)
  const [confirmedAddress, setConfirmedAddress] = useState<string | null>(null)

  const values = form.getValues()

  const photos = images
    .filter((image) => image.kind === 'photo')
    .sort((a, b) => a.position - b.position)
  const photoCount = photos.length
  const coverPhoto = photos[0]

  const rollup = EDITABLE_STEPS.flatMap((step) => {
    const { fieldErrors } = validateWizardStep(
      step,
      values as unknown as Record<string, unknown>,
    )
    return Object.values(fieldErrors)
      .filter((message): message is string => Boolean(message))
      .map((message) => ({ step, message }))
  })

  async function handleSubmit() {
    setSubmitting(true)
    setSubmitError(null)
    try {
      const listing = await submitListing(listingId)
      setConfirmedAddress(listing.displayAddress)
    } catch (error) {
      setSubmitError(
        error instanceof ListingsApiError
          ? error.message
          : 'Something went wrong on our end — try again in a moment.',
      )
    } finally {
      setSubmitting(false)
    }
  }

  if (confirmedAddress) {
    return (
      <div className="flex flex-col items-start gap-4">
        <Check aria-hidden="true" className="text-success size-8" />
        <h2 className="text-[length:var(--text-h3)]">
          {`You’re all set — ${confirmedAddress} is in for review.`}
        </h2>
        <p className="text-muted-foreground max-w-[60ch] text-base leading-relaxed">
          We usually approve listings within 24 hours. You&rsquo;ll get an email
          as soon as it&rsquo;s live, or if we need anything changed.
        </p>
        <Button
          render={<Link href="/lister" />}
          className="h-11 rounded-[var(--radius-md)] px-6"
        >
          Back to your listings
        </Button>
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-12">
      {rollup.length > 0 && (
        <div className="bg-destructive/10 text-destructive rounded-[var(--radius-md)] p-4">
          <p className="text-sm font-medium">
            There&rsquo;s something to fix before you can submit:
          </p>
          <ul className="mt-2 flex flex-col gap-1">
            {rollup.map(({ step, message }) => (
              <li key={`${step}-${message}`}>
                <button
                  type="button"
                  onClick={() => onEditStep(step)}
                  className="text-sm underline underline-offset-2"
                >
                  {message}
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}

      <SummaryGroup step={1} onEditStep={onEditStep}>
        <Row
          label="Channel"
          value={values.channel === 'rent' ? 'To rent' : 'For sale'}
        />
        <Row
          label="Property type"
          value={
            values.propertyType
              ? PROPERTY_TYPE_LABELS[values.propertyType]
              : '—'
          }
        />
      </SummaryGroup>

      <SummaryGroup step={2} onEditStep={onEditStep}>
        <Row label="Shown as" value={values.displayAddress || '—'} />
        <Row
          label="Approximate location"
          value={values.locationApproximate ? 'Yes' : 'No'}
        />
      </SummaryGroup>

      <SummaryGroup step={3} onEditStep={onEditStep}>
        <Row label="Bedrooms" value={bedroomsLabel(values.bedrooms)} />
        <Row
          label="Bathrooms"
          value={values.bathrooms === '' ? '—' : values.bathrooms}
        />
        <Row
          label={values.channel === 'rent' ? 'Rent' : 'Price'}
          value={
            values.price !== '' && values.priceQualifier
              ? formatPrice({
                  channel: values.channel || 'sale',
                  price: values.price,
                  priceQualifier: values.priceQualifier,
                })
              : '—'
          }
        />
        {values.channel === 'sale' ? (
          <Row
            label="Tenure"
            value={values.tenure ? TENURE_LABELS[values.tenure] : '—'}
          />
        ) : (
          <>
            <Row
              label="Furnished"
              value={
                values.furnished ? FURNISHED_LABELS[values.furnished] : '—'
              }
            />
            <Row label="Available from" value={values.availableFrom || '—'} />
            {values.deposit !== '' && (
              <Row
                label="Deposit"
                value={`£${values.deposit.toLocaleString('en-GB')}`}
              />
            )}
          </>
        )}
        {values.epcRating && (
          <Row label="EPC rating" value={values.epcRating} />
        )}
        {values.councilTaxBand && (
          <Row label="Council tax band" value={values.councilTaxBand} />
        )}
      </SummaryGroup>

      <SummaryGroup step={4} onEditStep={onEditStep}>
        <Row label="Description" value={values.description || '—'} />
        <Row
          label="Key features"
          value={values.features.length > 0 ? values.features.join(', ') : '—'}
        />
      </SummaryGroup>

      <SummaryGroup step={5} onEditStep={onEditStep}>
        <div className="flex items-center gap-3">
          {coverPhoto?.urls[0] && (
            // eslint-disable-next-line @next/next/no-img-element -- a remote, already-optimised variant URL, not a local asset.
            <img
              src={coverPhoto.urls[0].url}
              alt="Cover photo"
              className="aspect-[4/3] w-16 rounded-[var(--radius-sm)] object-cover"
            />
          )}
          <p className="text-foreground text-base">
            {photoCount === 0
              ? 'No photos added yet'
              : `${photoCount} photo${photoCount === 1 ? '' : 's'} added`}
          </p>
        </div>
      </SummaryGroup>

      <div className="flex flex-col gap-4">
        <p className="text-muted-foreground max-w-[60ch] text-base leading-relaxed">
          We check every listing before it goes live, usually within 24 hours.
          We&rsquo;ll email you the moment it&rsquo;s approved — or exactly what
          to change if it isn&rsquo;t.
        </p>
        {submitError && (
          <p role="alert" className="text-destructive text-sm">
            {submitError}
          </p>
        )}
        <Button
          type="button"
          aria-disabled={submitting}
          onClick={() => void handleSubmit()}
          className="h-11 w-full rounded-[var(--radius-md)] sm:w-auto"
        >
          {submitting
            ? 'Submitting…'
            : isRejected
              ? 'Resubmit for approval'
              : 'Submit for approval'}
        </Button>
      </div>
    </div>
  )
}
