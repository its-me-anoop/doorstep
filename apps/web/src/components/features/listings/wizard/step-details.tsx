'use client'

import { useEffect } from 'react'
import type { UseFormReturn } from 'react-hook-form'

import { Button } from '@/components/ui/button'
import {
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form'
import { Input } from '@/components/ui/input'
import { Select } from '@/components/ui/select'
import {
  COUNCIL_TAX_BAND,
  EPC_RATING,
  FURNISHED,
  PRICE_QUALIFIER,
  TENURE,
} from '@/lib/validation/listing'
import type { ListingFormValues } from '@/lib/listing-wizard-form'

import type { useStepValidation } from './use-step-validation'
import {
  FURNISHED_LABELS,
  PRICE_QUALIFIER_LABELS,
  TENURE_LABELS,
} from './wizard-labels'

const fieldClassName = 'h-11 rounded-[var(--radius-md)]'

const BEDROOM_OPTIONS = [
  { value: 0, label: 'Studio' },
  { value: 1, label: '1' },
  { value: 2, label: '2' },
  { value: 3, label: '3' },
  { value: 4, label: '4' },
  { value: 5, label: '5' },
  { value: 6, label: '6+' },
]

const BATHROOM_OPTIONS = [
  { value: 1, label: '1' },
  { value: 2, label: '2' },
  { value: 3, label: '3' },
  { value: 4, label: '4+' },
]

interface StepDetailsProps {
  form: UseFormReturn<ListingFormValues>
  validation: ReturnType<typeof useStepValidation>
}

/**
 * M1-DESIGN-SPEC.md §3.3. `furnished` and `availableFrom` are rendered
 * without a required asterisk, deliberately deviating from the spec's
 * literal copy (which marks both with `*`): submitListingSchema — the
 * real, enforced contract this task's instructions point at ("channel-
 * conditional fields per submitListingSchema") — leaves both nullish
 * with no channel-conditional superRefine check, by that schema's own
 * documented design (see lib/validation/listing.ts's doc comment: "PRD
 * §9.2 only mandates the EPC rating 'at publish'"). Marking them
 * required in the UI when nothing downstream ever enforces it would be a
 * false promise, not fidelity to the spec.
 */
export function StepDetails({ form, validation }: StepDetailsProps) {
  const { control, watch, setValue } = form
  const channel = watch('channel')

  useEffect(() => {
    if (channel === 'rent') setValue('priceQualifier', 'fixed')
  }, [channel, setValue])

  return (
    <div className="flex flex-col gap-6">
      <FormField
        control={control}
        name="bedrooms"
        render={({ field }) => (
          <FormItem>
            <FormLabel>Bedrooms</FormLabel>
            <FormControl>
              <Select
                name={field.name}
                value={field.value}
                ref={field.ref}
                onChange={(event) => field.onChange(Number(event.target.value))}
                onBlur={() => {
                  field.onBlur()
                  validation.validateField('bedrooms')
                }}
                className={fieldClassName}
              >
                <option value="" disabled>
                  Select…
                </option>
                {BEDROOM_OPTIONS.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </Select>
            </FormControl>
            <FormMessage />
          </FormItem>
        )}
      />

      <FormField
        control={control}
        name="bathrooms"
        render={({ field }) => (
          <FormItem>
            <FormLabel>Bathrooms</FormLabel>
            <FormControl>
              <Select
                name={field.name}
                value={field.value}
                ref={field.ref}
                onChange={(event) => field.onChange(Number(event.target.value))}
                onBlur={() => {
                  field.onBlur()
                  validation.validateField('bathrooms')
                }}
                className={fieldClassName}
              >
                <option value="" disabled>
                  Select…
                </option>
                {BATHROOM_OPTIONS.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </Select>
            </FormControl>
            <FormMessage />
          </FormItem>
        )}
      />

      {channel === 'sale' ? (
        <fieldset className="flex flex-col gap-6">
          <legend className="text-muted-foreground text-xs font-semibold tracking-[0.04em] uppercase">
            Sale details
          </legend>

          <FormField
            control={control}
            name="price"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Price</FormLabel>
                <div className="relative">
                  <span className="text-muted-foreground pointer-events-none absolute top-1/2 left-3 -translate-y-1/2 text-base">
                    £
                  </span>
                  <FormControl>
                    <Input
                      name={field.name}
                      ref={field.ref}
                      inputMode="numeric"
                      value={field.value}
                      onChange={(event) =>
                        field.onChange(
                          event.target.value === ''
                            ? ''
                            : Number(event.target.value),
                        )
                      }
                      onBlur={() => {
                        field.onBlur()
                        validation.validateField('price')
                      }}
                      className={`${fieldClassName} pl-7`}
                    />
                  </FormControl>
                </div>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={control}
            name="priceQualifier"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Price qualifier</FormLabel>
                <FormControl>
                  <Select
                    {...field}
                    onBlur={() => {
                      field.onBlur()
                      validation.validateField('priceQualifier')
                    }}
                    className={fieldClassName}
                  >
                    <option value="" disabled>
                      Select…
                    </option>
                    {PRICE_QUALIFIER.options.map((option) => (
                      <option key={option} value={option}>
                        {PRICE_QUALIFIER_LABELS[option]}
                      </option>
                    ))}
                  </Select>
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={control}
            name="tenure"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Tenure</FormLabel>
                <FormControl>
                  <Select
                    {...field}
                    onBlur={() => {
                      field.onBlur()
                      validation.validateField('tenure')
                    }}
                    className={fieldClassName}
                  >
                    <option value="" disabled>
                      Select…
                    </option>
                    {TENURE.options.map((option) => (
                      <option key={option} value={option}>
                        {TENURE_LABELS[option]}
                      </option>
                    ))}
                  </Select>
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
        </fieldset>
      ) : (
        <fieldset className="flex flex-col gap-6">
          <legend className="text-muted-foreground text-xs font-semibold tracking-[0.04em] uppercase">
            Rental details
          </legend>

          <FormField
            control={control}
            name="price"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Rent</FormLabel>
                <div className="relative">
                  <span className="text-muted-foreground pointer-events-none absolute top-1/2 left-3 -translate-y-1/2 text-base">
                    £
                  </span>
                  <span className="text-muted-foreground pointer-events-none absolute top-1/2 right-3 -translate-y-1/2 text-sm">
                    pcm
                  </span>
                  <FormControl>
                    <Input
                      name={field.name}
                      ref={field.ref}
                      inputMode="numeric"
                      value={field.value}
                      onChange={(event) =>
                        field.onChange(
                          event.target.value === ''
                            ? ''
                            : Number(event.target.value),
                        )
                      }
                      onBlur={() => {
                        field.onBlur()
                        validation.validateField('price')
                      }}
                      className={`${fieldClassName} pr-12 pl-7`}
                    />
                  </FormControl>
                </div>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={control}
            name="furnished"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Furnished</FormLabel>
                <FormControl>
                  <Select {...field} className={fieldClassName}>
                    <option value="" disabled>
                      Select…
                    </option>
                    {FURNISHED.options.map((option) => (
                      <option key={option} value={option}>
                        {FURNISHED_LABELS[option]}
                      </option>
                    ))}
                  </Select>
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={control}
            name="availableFrom"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Available from</FormLabel>
                <div className="flex gap-2">
                  <FormControl>
                    <Input
                      {...field}
                      type="date"
                      className={`${fieldClassName} w-full sm:w-48`}
                    />
                  </FormControl>
                  <Button
                    type="button"
                    variant="ghost"
                    onClick={() =>
                      field.onChange(new Date().toISOString().slice(0, 10))
                    }
                    className="h-11 px-3 text-sm"
                  >
                    Now
                  </Button>
                </div>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={control}
            name="deposit"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Deposit</FormLabel>
                <div className="relative">
                  <span className="text-muted-foreground pointer-events-none absolute top-1/2 left-3 -translate-y-1/2 text-base">
                    £
                  </span>
                  <FormControl>
                    <Input
                      name={field.name}
                      ref={field.ref}
                      inputMode="numeric"
                      value={field.value}
                      onChange={(event) =>
                        field.onChange(
                          event.target.value === ''
                            ? ''
                            : Number(event.target.value),
                        )
                      }
                      onBlur={field.onBlur}
                      className={`${fieldClassName} pl-7`}
                    />
                  </FormControl>
                </div>
                <p className="text-muted-foreground text-sm">
                  Usually 5 weeks&rsquo; rent for tenancies under £50,000 a
                  year.
                </p>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={control}
            name="epcRating"
            render={({ field }) => (
              <FormItem>
                <FormLabel>EPC rating</FormLabel>
                <FormControl>
                  <Select
                    {...field}
                    onBlur={() => {
                      field.onBlur()
                      validation.validateField('epcRating')
                    }}
                    className={`${fieldClassName} w-full sm:w-32`}
                  >
                    <option value="" disabled>
                      Select…
                    </option>
                    {EPC_RATING.options.map((option) => (
                      <option key={option} value={option}>
                        {option}
                      </option>
                    ))}
                  </Select>
                </FormControl>
                <p className="text-muted-foreground text-sm">
                  Required by law for rental listings.
                </p>
                <FormMessage />
              </FormItem>
            )}
          />
        </fieldset>
      )}

      {channel === 'sale' && (
        <FormField
          control={control}
          name="epcRating"
          render={({ field }) => (
            <FormItem>
              <FormLabel>EPC rating (optional)</FormLabel>
              <FormControl>
                <Select
                  {...field}
                  className={`${fieldClassName} w-full sm:w-32`}
                >
                  <option value="" disabled>
                    Select…
                  </option>
                  {EPC_RATING.options.map((option) => (
                    <option key={option} value={option}>
                      {option}
                    </option>
                  ))}
                </Select>
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
      )}

      <FormField
        control={control}
        name="councilTaxBand"
        render={({ field }) => (
          <FormItem>
            <FormLabel>Council tax band (optional)</FormLabel>
            <FormControl>
              <Select {...field} className={`${fieldClassName} w-full sm:w-32`}>
                <option value="" disabled>
                  Select…
                </option>
                {COUNCIL_TAX_BAND.options.map((option) => (
                  <option key={option} value={option}>
                    {option}
                  </option>
                ))}
              </Select>
            </FormControl>
            <p className="text-muted-foreground text-sm">
              Not sure? Check your band on{' '}
              <a
                href="https://www.gov.uk/council-tax-bands"
                className="text-primary underline"
              >
                gov.uk
              </a>
              .
            </p>
            <FormMessage />
          </FormItem>
        )}
      />
    </div>
  )
}
