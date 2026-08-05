'use client'

import { useEffect, useState } from 'react'
import { Check } from 'lucide-react'
import type { UseFormReturn } from 'react-hook-form'

import {
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form'
import { Input } from '@/components/ui/input'
import { Switch } from '@/components/ui/switch'
import { Button } from '@/components/ui/button'
import { computeDisplayAddress } from '@/lib/format-address'
import { geocodeSearch } from '@/lib/listings-client'
import type { ListingFormValues } from '@/lib/listing-wizard-form'

import type { useStepValidation } from './use-step-validation'

const fieldClassName = 'h-11 rounded-[var(--radius-md)]'

type LookupState = 'idle' | 'loading' | 'found' | 'not_found' | 'error'

interface StepAddressProps {
  form: UseFormReturn<ListingFormValues>
  validation: ReturnType<typeof useStepValidation>
}

/** M1-DESIGN-SPEC.md §3.2: postcode lookup, address line 1, the
 * display-address choice and its live preview, and the
 * approximate-location toggle. */
export function StepAddress({ form, validation }: StepAddressProps) {
  const { control, watch, setValue, getValues } = form
  const [lookupState, setLookupState] = useState<LookupState>(() =>
    getValues('town') ? 'found' : 'idle',
  )

  const [addressLine1, town, outcode, postcode, displayAddressChoice] = watch([
    'addressLine1',
    'town',
    'outcode',
    'postcode',
    'displayAddressChoice',
  ])

  useEffect(() => {
    setValue(
      'displayAddress',
      computeDisplayAddress(displayAddressChoice, {
        addressLine1,
        town,
        outcode,
        postcode,
      }),
      { shouldDirty: true },
    )
  }, [addressLine1, town, outcode, postcode, displayAddressChoice, setValue])

  async function findAddress() {
    const query = getValues('postcode').trim()
    if (!query) return

    setLookupState('loading')
    try {
      const results = await geocodeSearch(query)
      const result = results[0]
      if (!result) {
        setValue('location', null)
        setLookupState('not_found')
        return
      }
      setValue('town', result.label, { shouldDirty: true })
      setValue('outcode', result.outcode ?? '', { shouldDirty: true })
      setValue(
        'location',
        { lat: result.lat, lng: result.lng },
        { shouldDirty: true },
      )
      setLookupState('found')
      validation.validateField('location')
    } catch {
      setValue('location', null)
      setLookupState('error')
    }
  }

  const streetPreview = computeDisplayAddress('street', {
    addressLine1,
    town,
    outcode,
    postcode,
  })
  const fullPreview = computeDisplayAddress('full', {
    addressLine1,
    town,
    outcode,
    postcode,
  })

  return (
    <div className="flex flex-col gap-6">
      <FormField
        control={control}
        name="postcode"
        render={({ field }) => (
          <FormItem>
            <FormLabel>Postcode</FormLabel>
            <div className="flex gap-2">
              <FormControl>
                <Input
                  {...field}
                  onBlur={() => {
                    field.onBlur()
                    validation.validateField('postcode')
                  }}
                  className={`${fieldClassName} w-full sm:w-48`}
                />
              </FormControl>
              <Button
                type="button"
                variant="secondary"
                aria-disabled={lookupState === 'loading'}
                onClick={() => void findAddress()}
                className={`${fieldClassName} shrink-0 px-4`}
              >
                {lookupState === 'loading' ? 'Finding…' : 'Find address'}
              </Button>
            </div>
            {lookupState === 'found' && (
              <p className="text-success flex items-center gap-1 text-sm">
                <Check aria-hidden="true" className="size-3.5" />
                {`Found: ${town}, ${outcode}.`}
              </p>
            )}
            {lookupState === 'not_found' && (
              <p role="alert" className="text-destructive text-sm">
                We couldn&rsquo;t find that postcode — check it&rsquo;s typed
                correctly, or enter your address manually below.
              </p>
            )}
            {lookupState === 'error' && (
              <p role="alert" className="text-destructive text-sm">
                Something went wrong looking that up — try again.
              </p>
            )}
            <FormMessage />
          </FormItem>
        )}
      />

      {lookupState === 'not_found' && (
        <FormField
          control={control}
          name="town"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Town</FormLabel>
              <FormControl>
                <Input
                  {...field}
                  onBlur={() => {
                    field.onBlur()
                    validation.validateField('town')
                  }}
                  className={fieldClassName}
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
      )}

      <FormField
        control={control}
        name="addressLine1"
        render={({ field }) => (
          <FormItem>
            <FormLabel>Address line 1</FormLabel>
            <FormControl>
              <Input
                {...field}
                onBlur={() => {
                  field.onBlur()
                  validation.validateField('addressLine1')
                }}
                className={fieldClassName}
              />
            </FormControl>
            <p className="text-muted-foreground text-sm">
              House number and street name.
            </p>
            <FormMessage />
          </FormItem>
        )}
      />

      <FormField
        control={control}
        name="displayAddressChoice"
        render={({ field }) => (
          <FormItem>
            <p className="text-muted-foreground text-sm">
              Your exact address is never shown publicly — this choice only
              affects what buyers and renters see before they enquire.
            </p>
            <div
              role="radiogroup"
              aria-label="Display address"
              className="flex flex-col gap-3"
            >
              <label className="flex items-start gap-2">
                <input
                  type="radio"
                  name="displayAddressChoice"
                  value="street"
                  checked={field.value === 'street'}
                  onChange={() => field.onChange('street')}
                  className="mt-1 size-[18px] accent-[var(--clay-500)]"
                />
                <span>
                  <span className="text-foreground text-sm">
                    Street name and area only <em>(recommended)</em>
                  </span>
                  {field.value === 'street' && streetPreview && (
                    <p className="text-muted-foreground text-sm">
                      {`Shown as: ${streetPreview}.`}
                    </p>
                  )}
                </span>
              </label>
              <label className="flex items-start gap-2">
                <input
                  type="radio"
                  name="displayAddressChoice"
                  value="full"
                  checked={field.value === 'full'}
                  onChange={() => field.onChange('full')}
                  className="mt-1 size-[18px] accent-[var(--clay-500)]"
                />
                <span>
                  <span className="text-foreground text-sm">Full address</span>
                  {field.value === 'full' && fullPreview && (
                    <p className="text-muted-foreground text-sm">
                      {`Shown as: ${fullPreview}.`}
                    </p>
                  )}
                </span>
              </label>
            </div>
          </FormItem>
        )}
      />

      <FormField
        control={control}
        name="locationApproximate"
        render={({ field }) => (
          <FormItem>
            <label className="flex items-center gap-3">
              <Switch
                checked={field.value}
                onChange={(event) => field.onChange(event.target.checked)}
              />
              <span className="text-foreground text-sm">
                Show an approximate location instead of an exact pin
              </span>
            </label>
            <p className="text-muted-foreground text-sm">
              Good for extra privacy — we&rsquo;ll show a circle over the
              general area rather than pinpointing your door.
            </p>
          </FormItem>
        )}
      />
    </div>
  )
}
