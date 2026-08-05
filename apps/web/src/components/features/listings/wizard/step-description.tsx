'use client'

import { Controller, type UseFormReturn } from 'react-hook-form'

import {
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import type { ListingFormValues } from '@/lib/listing-wizard-form'

import { FeatureChipInput } from './feature-chip-input'
import type { useStepValidation } from './use-step-validation'

const DESCRIPTION_MAX_LENGTH = 2000

interface StepDescriptionProps {
  form: UseFormReturn<ListingFormValues>
  validation: ReturnType<typeof useStepValidation>
}

/** M1-DESIGN-SPEC.md §3.4: description + the key-features chip input. */
export function StepDescription({ form, validation }: StepDescriptionProps) {
  const description = form.watch('description')

  return (
    <div className="flex flex-col gap-12">
      <FormField
        control={form.control}
        name="description"
        render={({ field }) => (
          <FormItem>
            <FormLabel>Description</FormLabel>
            <FormControl>
              <Textarea
                {...field}
                rows={8}
                maxLength={DESCRIPTION_MAX_LENGTH}
                className="resize-y rounded-[var(--radius-md)]"
                onBlur={() => {
                  field.onBlur()
                  validation.validateField('description')
                }}
              />
            </FormControl>
            <div className="flex items-start justify-between gap-4">
              <p className="text-muted-foreground text-sm">
                Describe the property in your own words — what makes it a good
                home, not just a list of rooms.
              </p>
              <p className="text-muted-foreground shrink-0 text-xs">
                {`${description.length.toLocaleString('en-GB')} / ${DESCRIPTION_MAX_LENGTH.toLocaleString('en-GB')}`}
              </p>
            </div>
            <FormMessage />
          </FormItem>
        )}
      />

      <div className="flex flex-col gap-3">
        <Label>Key features (up to 10)</Label>
        <Controller
          control={form.control}
          name="features"
          render={({ field }) => (
            <FeatureChipInput value={field.value} onChange={field.onChange} />
          )}
        />
      </div>
    </div>
  )
}
