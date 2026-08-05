/**
 * Per-step validation for the create-listing wizard (PRD §6.5 LST-2,
 * M1-DESIGN-SPEC.md §1.1: "Continue is never disabled... clicking it
 * while a step is invalid triggers validation display... and does not
 * advance").
 *
 * Each step schema is built by `.pick()`-ing that step's own fields off
 * submitListingFieldsSchema — the same field types, requiredness and
 * messages the server enforces at final submit, reused rather than
 * hand-typed a second time (this file's one export deliberately
 * documents *why* this can't instead just filter submitListingSchema's
 * own issues down to a step's fields: see listing.ts's
 * draftListingFieldsSchema/submitListingFieldsSchema doc comment —
 * `superRefine` only runs once the whole object underneath it parses
 * cleanly, which a mid-wizard snapshot never does).
 *
 * `title` never appears in any step: it isn't a wizard field at all
 * (always server-derived, domain/listing-copy.ts), so it's never picked.
 */

import {
  applyChannelConditionalRequirements,
  submitListingFieldsSchema,
} from './listing'

const step1Schema = submitListingFieldsSchema.pick({
  channel: true,
  propertyType: true,
})

const step2Schema = submitListingFieldsSchema.pick({
  addressLine1: true,
  displayAddress: true,
  town: true,
  outcode: true,
  postcode: true,
  location: true,
})

const step3Schema = submitListingFieldsSchema
  .pick({
    channel: true,
    bedrooms: true,
    bathrooms: true,
    price: true,
    priceQualifier: true,
    tenure: true,
    epcRating: true,
  })
  .superRefine(applyChannelConditionalRequirements)

const step4Schema = submitListingFieldsSchema.pick({ description: true })

export const WIZARD_STEP_FIELDS = {
  1: ['channel', 'propertyType'],
  2: [
    'addressLine1',
    'displayAddress',
    'town',
    'outcode',
    'postcode',
    'location',
  ],
  3: [
    'bedrooms',
    'bathrooms',
    'price',
    'priceQualifier',
    'tenure',
    'epcRating',
  ],
  4: ['description'],
} as const

export type WizardStep = keyof typeof WIZARD_STEP_FIELDS

const STEP_SCHEMAS = {
  1: step1Schema,
  2: step2Schema,
  3: step3Schema,
  4: step4Schema,
} as const

/**
 * A handful of submitListingSchema fields carry no custom `.message()` —
 * they only need one because nothing else in the schema requires the
 * field on its own (an enum's built-in "invalid option" text, or a plain
 * `z.object()`'s built-in "expected object" text, neither written for a
 * human). Overriding just these, by exact field name, is cheaper and far
 * more robust than trying to detect "does this message look
 * zod-generated" at runtime.
 */
const FIELD_MESSAGE_OVERRIDES: Partial<Record<string, string>> = {
  channel: 'Choose for sale or to rent.',
  propertyType: 'Choose a property type.',
  priceQualifier: 'Choose a price qualifier.',
  location: 'Look up your postcode to set the location.',
}

export interface StepValidationResult {
  valid: boolean
  fieldErrors: Partial<Record<string, string>>
}

/**
 * The wizard form's own "nothing chosen yet" sentinel for every
 * `<select>` is `''` (lib/listing-wizard-form.ts — native selects can't
 * bind to `undefined`), but an unpicked `z.enum(...).nullish()` field's
 * real "absent" value is `undefined`/`null`: it rejects `''` outright as
 * an invalid enum member, an `invalid_value` issue that (a) fails the
 * parse before `applyChannelConditionalRequirements`'s superRefine ever
 * gets to run (producing the friendlier "Tenure is required..." text)
 * and (b) has no per-field custom message to fall back on either.
 * Normalizing just the enum-typed fields sidesteps both — every other
 * field (numbers, `.min(1, '...')` strings) already produces its right
 * custom message for `''` exactly as it does for `undefined`, so
 * touching them here would only risk *losing* a message, not gaining
 * one.
 */
const ENUM_FIELDS: ReadonlySet<string> = new Set([
  'channel',
  'propertyType',
  'priceQualifier',
  'tenure',
  'furnished',
  'epcRating',
  'councilTaxBand',
])

function normalizeBlanks(
  values: Record<string, unknown>,
): Record<string, unknown> {
  const normalized = { ...values }
  for (const field of ENUM_FIELDS) {
    if (normalized[field] === '') normalized[field] = undefined
  }
  return normalized
}

export function validateWizardStep(
  step: WizardStep,
  values: Record<string, unknown>,
): StepValidationResult {
  const result = STEP_SCHEMAS[step].safeParse(normalizeBlanks(values))
  if (result.success) return { valid: true, fieldErrors: {} }

  const stepFields = new Set<string>(WIZARD_STEP_FIELDS[step])
  const fieldErrors: Partial<Record<string, string>> = {}

  for (const issue of result.error.issues) {
    const field = String(issue.path[0])
    if (!stepFields.has(field) || field in fieldErrors) continue
    fieldErrors[field] = FIELD_MESSAGE_OVERRIDES[field] ?? issue.message
  }

  return { valid: Object.keys(fieldErrors).length === 0, fieldErrors }
}
