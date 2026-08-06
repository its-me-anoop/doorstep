/**
 * The zod schema behind GET /api/v1/search's query string (PRD §10, §8.6).
 * Every field starts life as a string (or is simply absent) straight off
 * `URLSearchParams` — the route (app/api/v1/search/route.ts) builds a
 * plain `Record<string, string | undefined>` from the request's search
 * params and safeParses it against `searchQuerySchema` unchanged, the same
 * "raw strings in, safeParse, 400 on failure" shape every other query
 * schema in this codebase already uses (app/api/v1/listings/route.ts's
 * listQuerySchema, app/api/v1/geocode/route.ts's geocodeQuerySchema).
 *
 * Geo is one of three mutually exclusive shapes, matching
 * ports/search-index.ts's `GeoQuery` union one level up:
 *  - `lat`+`lng` (+ optional `radiusMiles`) — a point-radius search. The
 *    "default this-area-only ~1 mile" PRD §8.6 calls for is deliberately
 *    NOT baked in here as a zod `.default()` — a default belongs to the
 *    *translation* into a SearchQuery (services/search/search-listings.ts
 *    is where `geo` actually gets built), not to what counts as a validly
 *    shaped request. This schema only enforces the 0.25-30 mile bound when
 *    `radiusMiles` is actually supplied.
 *  - `bboxNeLat`/`bboxNeLng`/`bboxSwLat`/`bboxSwLng`, all four together —
 *    a map-viewport search (PRD §8.6's `_geoBoundingBox`, out of scope for
 *    the map UI itself per M3, but the query shape is accepted now since
 *    the adapter already implements it). NE = ports/search-index.ts's
 *    `BoundingBoxGeoQuery.topRight`, SW = `.bottomLeft`.
 *  - neither — PRD §8.6's "all-GB" case; ports/search-index.ts's `geo`
 *    field is simply omitted for this query.
 * A request naming both a radius point and a bbox, or only half of a
 * lat/lng pair, or only some of the four bbox corners, is 400 junk, not a
 * best-effort guess at which one was meant.
 *
 * Every other filter is channel-agnostic at this layer on purpose: e.g.
 * `tenure` on a `channel=rent` request isn't rejected — a rent document
 * always has `tenure: null` (ports/search-index.ts), so that filter
 * simply matches nothing, the same way Meilisearch's own AND-of-clauses
 * filter model behaves for any other clause that happens not to apply.
 * Manufacturing a channel-conditional 400 for every such combination would
 * be validation-layer logic duplicating what the query itself already
 * expresses correctly.
 */

import { z } from 'zod'

import { CHANNEL, FURNISHED, PROPERTY_TYPE, TENURE } from './listing'

const LAT = z.coerce.number().min(-90).max(90)
const LNG = z.coerce.number().min(-180).max(180)

const RADIUS_MILES_MIN = 0.25
const RADIUS_MILES_MAX = 30
const PAGE_MAX = 200

/** M3-DESIGN-SPEC.md §1.3's own cluster-label display cap, reused here as
 * the map's fetch-window cap too (search-url.ts's
 * `buildMapSearchApiQuery`) — the spec text itself only assigns "200" to
 * cluster label text ("exact count up to 200; 200+ above that"), not to
 * how many hits get fetched, but reusing the one number the spec already
 * treats as meaningful in this exact feature area avoids inventing a
 * second, arbitrary constant for the one place the spec is silent: an
 * unfiltered, nationwide query has no fetch-side bound at all otherwise,
 * which would turn "the map plots every matching hit in the query" into
 * an unbounded payload/render cost for the one case that matters most. */
export const MAX_HITS_PER_PAGE = 200

export const SEARCH_SORT = z.enum(['newest', 'price_asc', 'price_desc'])

/** `'true'`/`'false'` only — anything else (including an empty string) is
 * rejected rather than silently coerced, unlike zod's own `z.coerce.boolean()`
 * (which treats any non-empty string, including the literal `"false"`, as
 * `true`). `.optional()` sits outermost (not wrapped by the transform) so
 * an absent param leaves this key genuinely optional in the inferred
 * output type (`newHome?: boolean`) rather than a required key typed
 * `boolean | undefined` — the latter would force every caller building a
 * SearchQueryInput by hand (e.g. tests) to spell out `newHome: undefined`
 * explicitly instead of just omitting it. */
const booleanQueryParam = z
  .enum(['true', 'false'])
  .transform((value) => value === 'true')
  .optional()

/** `undefined` in, `undefined` out; a non-empty comma list is split and
 * trimmed before the inner array schema validates each entry — an empty
 * string (`types=`) normalises to `undefined` (equivalent to omitting the
 * param) rather than "must match zero types". */
function splitCommaList(value: unknown): unknown {
  if (typeof value !== 'string') return value
  const items = value
    .split(',')
    .map((item) => item.trim())
    .filter((item) => item.length > 0)
  return items.length > 0 ? items : undefined
}

const AVAILABLE_BY = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, 'availableBy must be YYYY-MM-DD')

export const searchQuerySchema = z
  .object({
    channel: CHANNEL,

    // Radius geo.
    lat: LAT.optional(),
    lng: LNG.optional(),
    radiusMiles: z.coerce
      .number()
      .min(RADIUS_MILES_MIN)
      .max(RADIUS_MILES_MAX)
      .optional(),

    // Bounding-box geo.
    bboxNeLat: LAT.optional(),
    bboxNeLng: LNG.optional(),
    bboxSwLat: LAT.optional(),
    bboxSwLng: LNG.optional(),

    // Filters.
    priceMin: z.coerce.number().int().min(0).optional(),
    priceMax: z.coerce.number().int().min(0).optional(),
    bedsMin: z.coerce.number().int().min(0).optional(),
    bedsMax: z.coerce.number().int().min(0).optional(),
    bathsMin: z.coerce.number().int().min(0).optional(),
    types: z.preprocess(splitCommaList, z.array(PROPERTY_TYPE).optional()),
    tenure: TENURE.optional(),
    furnished: FURNISHED.optional(),
    availableBy: AVAILABLE_BY.optional(),
    newHome: booleanQueryParam,
    town: z.string().trim().min(1).optional(),
    outcode: z.string().trim().min(1).optional(),

    sort: SEARCH_SORT.default('newest'),
    page: z.coerce.number().int().min(1).max(PAGE_MAX).default(1),
    /** M3-DESIGN-SPEC.md §1.3: the map's own fetch window, independent of
     * `page` above (`page` is the list column's paginated cursor into a
     * fixed 24-item window; this is the size of a *different* window the
     * map's own marker layer requests — see search-url.ts's
     * `buildMapSearchApiQuery`). No `.default()` — an absent value leaves
     * this genuinely optional so `services/search/search-listings.ts`'s
     * translation into `SearchQuery` can omit it and let
     * `adapters/meilisearch`'s own `DEFAULT_HITS_PER_PAGE` (24) apply,
     * unchanged, for every caller that never asks for a bigger window. */
    hitsPerPage: z.coerce
      .number()
      .int()
      .min(1)
      .max(MAX_HITS_PER_PAGE)
      .optional(),
  })
  .superRefine((data, ctx) => {
    const hasLat = data.lat !== undefined
    const hasLng = data.lng !== undefined
    if (hasLat !== hasLng) {
      ctx.addIssue({
        code: 'custom',
        path: ['lat'],
        message: 'lat and lng must both be provided together',
      })
    }

    const bboxFields = [
      data.bboxNeLat,
      data.bboxNeLng,
      data.bboxSwLat,
      data.bboxSwLng,
    ]
    const bboxProvidedCount = bboxFields.filter((v) => v !== undefined).length
    const hasBbox = bboxProvidedCount === 4
    if (bboxProvidedCount > 0 && bboxProvidedCount < 4) {
      ctx.addIssue({
        code: 'custom',
        path: ['bboxNeLat'],
        message:
          'bboxNeLat, bboxNeLng, bboxSwLat and bboxSwLng must all be provided together',
      })
    }

    if (hasLat && hasLng && hasBbox) {
      ctx.addIssue({
        code: 'custom',
        path: ['bboxNeLat'],
        message: 'Provide either a lat/lng radius search or a bbox, not both',
      })
    }

    if (
      data.priceMin !== undefined &&
      data.priceMax !== undefined &&
      data.priceMin > data.priceMax
    ) {
      ctx.addIssue({
        code: 'custom',
        path: ['priceMax'],
        message: 'priceMax must be greater than or equal to priceMin',
      })
    }

    if (
      data.bedsMin !== undefined &&
      data.bedsMax !== undefined &&
      data.bedsMin > data.bedsMax
    ) {
      ctx.addIssue({
        code: 'custom',
        path: ['bedsMax'],
        message: 'bedsMax must be greater than or equal to bedsMin',
      })
    }
  })

export type SearchQueryInput = z.infer<typeof searchQuerySchema>
