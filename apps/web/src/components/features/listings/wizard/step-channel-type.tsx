'use client'

import { Check } from 'lucide-react'
import type { UseFormReturn } from 'react-hook-form'

import {
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form'
import { Select } from '@/components/ui/select'
import { PROPERTY_TYPE } from '@/lib/validation/listing'
import type { ListingFormValues } from '@/lib/listing-wizard-form'
import type { Channel } from '@/domain/enums'

import type { useStepValidation } from './use-step-validation'
import { PROPERTY_TYPE_LABELS } from './wizard-labels'

interface ChannelTileProps {
  label: string
  selected: boolean
  onSelect: () => void
}

function ChannelTile({ label, selected, onSelect }: ChannelTileProps) {
  return (
    <button
      type="button"
      aria-pressed={selected}
      onClick={onSelect}
      className={`relative flex-1 rounded-[var(--radius-md)] border p-6 text-left transition-colors ${
        selected
          ? 'border-primary bg-primary-foreground'
          : 'border-input hover:border-primary/50'
      }`}
    >
      <p className="text-foreground text-[length:var(--text-lead)] font-medium">
        {label}
      </p>
      {selected && (
        <Check
          aria-hidden="true"
          className="text-primary absolute top-4 right-4 size-4"
        />
      )}
    </button>
  )
}

interface StepChannelTypeProps {
  form: UseFormReturn<ListingFormValues>
  validation: ReturnType<typeof useStepValidation>
}

/** M1-DESIGN-SPEC.md §3.1: channel tiles + the property type select. */
export function StepChannelType({ form, validation }: StepChannelTypeProps) {
  const channel = form.watch('channel')
  const channelError = form.formState.errors.channel?.message

  function selectChannel(next: Channel) {
    form.setValue('channel', next, { shouldDirty: true })
    validation.validateField('channel')
  }

  return (
    <div className="flex flex-col gap-8">
      <div className="flex flex-col gap-4 max-[399px]:flex-col min-[400px]:flex-row">
        <ChannelTile
          label="For sale"
          selected={channel === 'sale'}
          onSelect={() => selectChannel('sale')}
        />
        <ChannelTile
          label="To rent"
          selected={channel === 'rent'}
          onSelect={() => selectChannel('rent')}
        />
      </div>
      {channelError && (
        <p role="alert" className="text-destructive text-sm">
          {channelError}
        </p>
      )}

      <FormField
        control={form.control}
        name="propertyType"
        render={({ field }) => (
          <FormItem>
            <FormLabel>Property type</FormLabel>
            <FormControl>
              <Select
                {...field}
                onBlur={() => {
                  field.onBlur()
                  validation.validateField('propertyType')
                }}
                className="h-11 rounded-[var(--radius-md)]"
              >
                <option value="" disabled>
                  Select a property type…
                </option>
                {PROPERTY_TYPE.options.map((option) => (
                  <option key={option} value={option}>
                    {PROPERTY_TYPE_LABELS[option]}
                  </option>
                ))}
              </Select>
            </FormControl>
            <FormMessage />
          </FormItem>
        )}
      />
    </div>
  )
}
