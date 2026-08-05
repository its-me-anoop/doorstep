/**
 * Zod schema for the "create an agency" step of lister onboarding (PRD
 * §6.5 LST-1, services/listers/create-agency.ts), shared between a future
 * onboarding form and the POST /api/v1/onboarding/agency route. Copy
 * matches DESIGN-SPEC.md §4 "Error and validation copy tone" — plain,
 * specific, never blames the user — same as lib/validation/auth.ts.
 *
 * `slug` is deliberately not a field here: it is always server-derived
 * from `name` (domain/slug.ts + services/listers/create-agency.ts's
 * dedupe loop), never client input, so there is nothing for a schema to
 * validate.
 *
 * Each field uses `.pipe()` rather than chained checks on one schema, same
 * reasoning as lib/validation/auth.ts: an empty value fails the `min(1)`
 * (or `min(2)`) stage and never reaches the format stage, so only one
 * issue is ever produced per field.
 */

import { z } from 'zod'

// Permissive on purpose: UK landline and mobile numbers alike ("0118 950
// 1147", "07700 900201", "+44 118 950 1147") are digits, spaces, and the
// usual punctuation, within a sane overall length. PRD §9.2 does not
// mandate a stricter format, and validating phone numbers precisely is a
// well-known trap (extensions, international formats) that is out of
// scope for M1.
const PHONE_PATTERN = /^[0-9+()\-\s]{7,20}$/

export const createAgencySchema = z.object({
  name: z
    .string()
    .trim()
    .min(2, 'Agency name must be at least 2 characters.')
    .pipe(z.string().max(80, 'Agency name must be 80 characters or fewer.')),
  phone: z
    .string()
    .trim()
    .min(1, 'Enter a contact phone number.')
    .pipe(
      z
        .string()
        .regex(
          PHONE_PATTERN,
          "That phone number doesn't look quite right — check for typos.",
        ),
    ),
  email: z
    .string()
    .trim()
    .min(1, 'Enter a contact email address.')
    .pipe(
      z.email("That email address doesn't look quite right — check for typos."),
    ),
  website: z
    .string()
    .trim()
    .min(1, 'Enter your agency website.')
    .pipe(
      z.url("That website address doesn't look quite right — check for typos."),
    ),
  address: z.string().trim().min(1, 'Enter your branch address.'),
})

export type CreateAgencyInput = z.infer<typeof createAgencySchema>
