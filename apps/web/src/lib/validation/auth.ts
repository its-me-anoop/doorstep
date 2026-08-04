/**
 * Zod schemas for the sign-in/sign-up forms, shared between the client
 * form components (React Hook Form's zodResolver) and, per PRD §6.5's
 * pattern for wizard steps, available to a future server-side check if
 * one is ever added. Copy matches DESIGN-SPEC.md §4 "Error and
 * validation copy tone" exactly — plain, specific, never blames the
 * user.
 *
 * Each field uses `.pipe()` rather than chained checks on one schema so
 * only one issue is ever produced per field: an empty value fails the
 * `min(1)` stage and never reaches the format/strength stage, which
 * keeps "Enter your email address." and "That email address doesn't
 * look quite right" from both firing on the same empty input.
 */

import { z } from 'zod'

const emailField = z
  .string()
  .trim()
  .min(1, 'Enter your email address.')
  .pipe(
    z.email("That email address doesn't look quite right — check for typos."),
  )

export const signUpSchema = z.object({
  fullName: z.string().trim().min(1, 'Enter your name.'),
  email: emailField,
  password: z
    .string()
    .min(1, 'Enter a password.')
    .pipe(z.string().min(8, 'Your password needs at least 8 characters.')),
  consent: z.boolean().refine((value) => value === true, {
    error: 'Agree to the Terms and Privacy Policy to continue.',
  }),
})

export const signInSchema = z.object({
  email: emailField,
  password: z.string().min(1, 'Enter your password.'),
})

export type SignUpFormValues = z.infer<typeof signUpSchema>
export type SignInFormValues = z.infer<typeof signInSchema>
