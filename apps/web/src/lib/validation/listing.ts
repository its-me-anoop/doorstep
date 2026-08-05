/**
 * Zod schemas for the `properties` table's writable fields (PRD §9.2, §6.5
 * LST-2), shared between the create-listing wizard and the server-side
 * routes it posts to. Two shapes, per PRD §6.5 LST-2's "a draft can be
 * saved at any step and resumed" vs. "submission moves the listing to
 * pending review":
 *
 *  - `draftListingSchema` — loose. Only `channel` and `propertyType` (the
 *    wizard's step 1) are required; every other field is optional so a
 *    half-filled wizard state can still be persisted. Any field that IS
 *    present is still validated for shape/range (services/listings/
 *    create-listing-draft.ts and update-listing.ts both use this), so a
 *    malformed partial save is rejected even though an incomplete one
 *    isn't.
 *  - `submitListingSchema` — strict. Every field required for a public
 *    listing must be present (services/listings/submit-listing.ts
 *    validates the *stored* listing against this before the
 *    draft/rejected -> pending_review transition, PRD §9.3). Channel-
 *    conditional: `tenure` required for sale; `epcRating` required for
 *    rent (furnished/availableFrom/deposit stay optional for rent — PRD
 *    §9.2 only mandates the EPC rating "at publish").
 *
 * `title` and `slug` are deliberately absent from both schemas — like
 * agencies.slug (lib/validation/agency.ts), they are always server-derived
 * (domain/listing-copy.ts), never client input.
 */

import { z } from 'zod'

import type { Channel, EpcRating, Tenure } from '@/domain/enums'

/**
 * The enum building blocks are exported (not just the two schemas built
 * from them) so lib/validation/listing-wizard.ts's per-step slices and
 * the wizard's <select> option lists can both draw their values from
 * this one source rather than re-typing the literal lists — the same
 * "reuse, don't duplicate field rules" principle this file's own top
 * comment already applies to draft vs. submit.
 */
export const CHANNEL = z.enum(['sale', 'rent'])
export const PROPERTY_TYPE = z.enum([
  'detached',
  'semi_detached',
  'terraced',
  'flat',
  'bungalow',
  'maisonette',
  'land',
  'other',
])
export const PRICE_QUALIFIER = z.enum([
  'fixed',
  'guide_price',
  'offers_over',
  'offers_in_region',
  'poa',
])
export const TENURE = z.enum([
  'freehold',
  'leasehold',
  'share_of_freehold',
  'unknown',
])
export const FURNISHED = z.enum(['furnished', 'part_furnished', 'unfurnished'])
export const EPC_RATING = z.enum(['A', 'B', 'C', 'D', 'E', 'F', 'G'])
export const COUNCIL_TAX_BAND = z.enum(['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H'])

const FEATURES_MAX = 10
const featuresSchema = z
  .array(z.string().trim().min(1))
  .max(FEATURES_MAX, `Add up to ${FEATURES_MAX} key features.`)

/** properties.price — integer pounds for sale, integer pcm for rent. */
const PRICE_RANGE: Record<Channel, { min: number; max: number }> = {
  sale: { min: 1_000, max: 100_000_000 },
  rent: { min: 50, max: 100_000 },
}

/**
 * Exported alongside the two field-set object schemas below (not just
 * the two full `...Schema`s) so lib/validation/listing-wizard.ts's step 3
 * slice can apply the exact same price-range rule to a step-scoped
 * parse, rather than re-typing the £ bounds and copy a second time.
 */
export function validatePriceRange(
  channel: Channel,
  price: number,
  ctx: z.core.$RefinementCtx,
): void {
  const { min, max } = PRICE_RANGE[channel]
  if (price < min || price > max) {
    const noun = channel === 'sale' ? 'sale price' : 'monthly rent'
    ctx.addIssue({
      code: 'custom',
      path: ['price'],
      message: `Enter a ${noun} between £${min.toLocaleString('en-GB')} and £${max.toLocaleString('en-GB')}.`,
    })
  }
}

const locationSchema = z.object({
  lat: z.number().min(-90).max(90),
  lng: z.number().min(-180).max(180),
})

/**
 * The pre-`superRefine` object schemas, exported so
 * lib/validation/listing-wizard.ts can `.pick()` a step's own fields for
 * a step-scoped parse. Picking straight off the built `...Schema`
 * (a `ZodEffects`-wrapped object) isn't an option — zod only runs a
 * `superRefine` once the *whole* object underneath it already parsed
 * cleanly, so filtering `submitListingSchema`'s issues down to one
 * step's fields would silently miss every channel-conditional issue
 * (tenure/epcRating) on any step checked before the wizard's later
 * steps (e.g. step 4's description) are filled in — which, mid-wizard,
 * they never are yet. Picking fields off the base object first sidesteps
 * that: a step schema only ever needs its own fields to parse cleanly.
 */
export const draftListingFieldsSchema = z.object({
  channel: CHANNEL,
  propertyType: PROPERTY_TYPE,
  description: z.string().trim().optional(),
  features: featuresSchema.optional(),
  bedrooms: z.number().int().min(0).optional(),
  bathrooms: z.number().int().min(0).optional(),
  price: z.number().int().optional(),
  priceQualifier: PRICE_QUALIFIER.optional(),
  tenure: TENURE.optional(),
  deposit: z.number().int().min(0).optional(),
  furnished: FURNISHED.optional(),
  availableFrom: z.coerce.date().optional(),
  epcRating: EPC_RATING.optional(),
  councilTaxBand: COUNCIL_TAX_BAND.optional(),
  newHome: z.boolean().optional(),
  addressLine1: z.string().trim().min(1).optional(),
  displayAddress: z.string().trim().min(1).optional(),
  town: z.string().trim().min(1).optional(),
  outcode: z.string().trim().min(1).optional(),
  postcode: z.string().trim().min(1).optional(),
  location: locationSchema.optional(),
  locationApproximate: z.boolean().optional(),
})

export const submitListingFieldsSchema = z.object({
  channel: CHANNEL,
  propertyType: PROPERTY_TYPE,
  title: z.string().trim().min(1, 'Add a listing title.'),
  description: z.string().trim().min(1, 'Add a description.'),
  features: featuresSchema.optional(),
  bedrooms: z.number({ error: 'Enter the number of bedrooms.' }).int().min(0),
  bathrooms: z.number({ error: 'Enter the number of bathrooms.' }).int().min(0),
  price: z.number({ error: 'Enter a price.' }).int(),
  priceQualifier: PRICE_QUALIFIER,
  tenure: TENURE.nullish(),
  deposit: z.number().int().min(0).nullish(),
  furnished: FURNISHED.nullish(),
  availableFrom: z.coerce.date().nullish(),
  epcRating: EPC_RATING.nullish(),
  councilTaxBand: COUNCIL_TAX_BAND.nullish(),
  newHome: z.boolean().optional(),
  addressLine1: z.string().trim().min(1, 'Enter address line 1.'),
  displayAddress: z.string().trim().min(1, 'Enter a display address.'),
  town: z.string().trim().min(1, 'Enter a town.'),
  outcode: z.string().trim().min(1, 'Enter an outcode.'),
  postcode: z.string().trim().min(1, 'Enter a postcode.'),
  location: locationSchema,
  locationApproximate: z.boolean().optional(),
})

/**
 * The channel-conditional rule (tenure required for sale, epcRating for
 * rent) plus the price-range check, factored out of submitListingSchema's
 * `superRefine` so lib/validation/listing-wizard.ts's step 3 slice can
 * apply the identical rule to its own (smaller) picked shape — one
 * function, two callers, rather than the tenure/epcRating messages
 * living in two places that could drift.
 */
export function applyChannelConditionalRequirements(
  data: {
    channel: Channel
    price: number
    tenure?: Tenure | null
    epcRating?: EpcRating | null
  },
  ctx: z.core.$RefinementCtx,
): void {
  validatePriceRange(data.channel, data.price, ctx)
  if (data.channel === 'sale' && !data.tenure) {
    ctx.addIssue({
      code: 'custom',
      path: ['tenure'],
      message: 'Tenure is required for sale listings.',
    })
  }
  if (data.channel === 'rent' && !data.epcRating) {
    ctx.addIssue({
      code: 'custom',
      path: ['epcRating'],
      message: 'EPC rating is required for rental listings.',
    })
  }
}

export const draftListingSchema = draftListingFieldsSchema.superRefine(
  (data, ctx) => {
    if (data.price !== undefined) {
      validatePriceRange(data.channel, data.price, ctx)
    }
  },
)

export const submitListingSchema = submitListingFieldsSchema.superRefine(
  applyChannelConditionalRequirements,
)

/**
 * The request body for POST /api/v1/listings/{id}/status (PRD §10):
 * one-click transitions (PRD §6.5 LST-5). The literal list mirrors
 * services/listings/change-listing-status.ts's `ListingStatusAction`
 * union — a zod enum can't derive from a TS type, so, like this file's
 * CHANNEL/PROPERTY_TYPE enums mirroring domain/enums.ts, this is a
 * deliberately duplicated literal list rather than a shared runtime
 * source.
 */
export const changeListingStatusSchema = z.object({
  action: z.enum([
    'sold_stc',
    'let_agreed',
    'complete',
    'hide',
    'unhide',
    'back_on_market',
  ]),
})

export type DraftListingInput = z.infer<typeof draftListingSchema>
export type SubmitListingInput = z.infer<typeof submitListingSchema>
export type ChangeListingStatusInput = z.infer<typeof changeListingStatusSchema>
