'use client'

import { zodResolver } from '@hookform/resolvers/zod'
import { useRouter } from 'next/navigation'
import { useState } from 'react'
import { useForm } from 'react-hook-form'

import { Button } from '@/components/ui/button'
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { createAgency, OnboardingApiError } from '@/lib/onboarding-client'
import {
  createAgencySchema,
  type CreateAgencyInput,
} from '@/lib/validation/agency'

import { finishOnboarding } from './finish-onboarding'

const fieldClassName = 'h-11 rounded-[var(--radius-md)]'
const GENERIC_ERROR = 'Something went wrong on our end — try again in a moment.'

interface AgencyFormProps {
  /** The signed-in user's account email — prefilled, still editable
   * (M1-DESIGN-SPEC.md §2.2 field 4). */
  defaultEmail: string
}

/**
 * AgencyForm — M1-DESIGN-SPEC.md §2.2's agency creation form, the one
 * legitimate bordered panel on this screen (a trust surface, same
 * reasoning as the auth panel: contact details that become public on the
 * agency page).
 *
 * Logo field (spec's field 2) is rendered exactly per spec's copy and
 * dimensions but is deliberately non-interactive: M1's backend has no
 * agency-logo upload endpoint at all — CreateAgency
 * (services/listers/create-agency.ts) hardcodes `logoPath: null` with a
 * comment deferring logo upload to LST-6's agency-profile management,
 * which isn't built yet. Wiring a clickable control with nothing behind
 * it would be worse than an honest static placeholder — see this
 * commit's fidelity notes for the full reasoning.
 */
export function AgencyForm({ defaultEmail }: AgencyFormProps) {
  const router = useRouter()
  const [submitError, setSubmitError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)

  const form = useForm<CreateAgencyInput>({
    resolver: zodResolver(createAgencySchema),
    mode: 'onBlur',
    defaultValues: {
      name: '',
      phone: '',
      email: defaultEmail,
      website: '',
      address: '',
    },
  })

  async function onSubmit(values: CreateAgencyInput) {
    setSubmitting(true)
    setSubmitError(null)
    try {
      await createAgency(values)
      await finishOnboarding(router)
    } catch (error) {
      setSubmitError(
        error instanceof OnboardingApiError ? error.message : GENERIC_ERROR,
      )
      setSubmitting(false)
    }
  }

  return (
    <div className="mx-auto max-w-[480px]">
      <h1 className="text-[length:var(--text-h1)] leading-[1.12]">
        Set up your agency
      </h1>

      <div className="border-border bg-card mt-8 rounded-[var(--radius-lg)] border p-8">
        <Form {...form}>
          <form
            onSubmit={form.handleSubmit(onSubmit)}
            noValidate
            className="flex flex-col gap-6"
          >
            <FormField
              control={form.control}
              name="name"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Agency name</FormLabel>
                  <FormControl>
                    <Input
                      autoComplete="organization"
                      className={fieldClassName}
                      {...field}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <div className="flex flex-col gap-2">
              <span className="text-sm leading-none font-medium">Logo</span>
              <div className="border-input flex size-24 items-center justify-center rounded-[var(--radius-sm)] border border-dashed">
                <span className="text-muted-foreground text-sm">Add logo</span>
              </div>
              <p className="text-muted-foreground text-sm">
                Optional — add this now or later from your agency profile.
              </p>
            </div>

            <FormField
              control={form.control}
              name="phone"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Phone</FormLabel>
                  <FormControl>
                    <Input
                      type="tel"
                      autoComplete="tel"
                      className={fieldClassName}
                      {...field}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="email"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Email</FormLabel>
                  <FormControl>
                    <Input
                      type="email"
                      autoComplete="email"
                      className={fieldClassName}
                      {...field}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="website"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Website</FormLabel>
                  <FormControl>
                    <Input
                      type="url"
                      autoComplete="url"
                      className={fieldClassName}
                      {...field}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="address"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Branch address</FormLabel>
                  <FormControl>
                    <Textarea
                      rows={2}
                      className="rounded-[var(--radius-md)]"
                      {...field}
                    />
                  </FormControl>
                  <p className="text-muted-foreground text-sm">
                    Shown publicly on your agency page.
                  </p>
                  <FormMessage />
                </FormItem>
              )}
            />

            {submitError && (
              <p
                role="alert"
                className="opacity-transition text-destructive text-sm"
              >
                {submitError}
              </p>
            )}

            <Button
              type="submit"
              aria-disabled={submitting}
              className="h-11 w-full rounded-[var(--radius-md)]"
            >
              {submitting
                ? 'Creating agency profile…'
                : 'Create agency profile'}
            </Button>
          </form>
        </Form>
      </div>
    </div>
  )
}
