/**
 * The public search URL vocabulary (M2-DESIGN-SPEC.md §1.7) — every
 * filter/sort/page/point criterion the results pages
 * (app/(public)/for-sale/**, app/(public)/to-rent/**) read from and write
 * to the address bar. SRCH-1/2's "the search survives URL sharing" means
 * this module, not component state, is the one source of truth for what
 * the current search *is*; components read/write through it rather than
 * inventing their own param names.
 *
 * Deliberately a **different** vocabulary from lib/validation/search.ts's
 * `searchQuerySchema` (the GET /api/v1/search query-param shape): the
 * public URL is end-user/SEO-facing copy (`minPrice`, `type`,
 * `availableFrom`...) where the API is an internal service contract
 * already shipped and frozen (`priceMin`, `types`, `availableBy`...).
 * `buildSearchApiQuery` is the one place that translates between them —
 * every page and every client re-query goes through it, so the two
 * vocabularies never drift out of sync in two different call sites.
 *
 * Canonicalisation (SEO): `searchUrlStateToSearchParams` never emits a
 * default-valued param (`sort=newest`, `page=1`) — parsing one back off
 * a URL that has it present already drops it from the returned state, so
 * `parse -> serialise` always converges on one canonical string for two
 * URLs that mean the same thing. `needsCanonicalRedirect` is what a page
 * calls to decide whether the *inbound* request URL needs a redirect to
 * that canonical form (the spec's "the server always redirects a URL
 * with default-valued params present").
 */

import type { Channel, Furnished, PropertyType } from '@/domain/enums'
import { FURNISHED, PROPERTY_TYPE } from '@/lib/validation/listing'
import { MAX_HITS_PER_PAGE, SEARCH_SORT } from '@/lib/validation/search'

export type SearchSort = 'newest' | 'price_asc' | 'price_desc'

/** §1.7: "one of 1, 3, 5, 10, 20, 30." */
export const SEARCH_RADIUS_MILES_OPTIONS: readonly number[] = [
  1, 3, 5, 10, 20, 30,
]

export interface SearchUrlState {
  minPrice?: number
  maxPrice?: number
  minBeds?: number
  maxBeds?: number
  /** Sorted ascending alphabetically wherever this module produces it,
   * for the same cache-key-stability reason §1.7 states for the API's
   * own `types` param. */
  type?: PropertyType[]
  /** Rent only — ignored (not an error) on a sale URL, see
   * `buildSearchApiQuery`. */
  furnished?: Furnished[]
  /** `YYYY-MM-DD`. Rent only, same ignore-on-sale rule. */
  availableFrom?: string
  /** Omitted entirely (both from parsed state and from a built URL) when
   * it equals the default `'newest'`. */
  sort?: SearchSort
  /** Omitted entirely when it equals the default `1`. */
  page?: number
  lat?: number
  lng?: number
  /** One of `SEARCH_RADIUS_MILES_OPTIONS`. */
  radius?: number
  /** Human-readable place text for heading/breadcrumb copy — display-only,
   * never sent to the search API (`buildSearchApiQuery` drops it). */
  label?: string
  /** M3-DESIGN-SPEC.md §1.9. Only `'map'` is ever written — list is the
   * default and is always omitted, the same canonicalisation rule as
   * `sort=newest`/`page=1`: a URL with `view=list` (or any other value)
   * present is non-canonical and redirects to drop it. */
  view?: 'map'
  /** The map viewport's four corners (§1.9) — reuses the API's own param
   * names verbatim (`lib/validation/search.ts`) rather than inventing
   * friendlier public names, since there's no clearer public name for a
   * map corner than its own lat/lng. All four together or none, the same
   * "must be paired" leniency §1.7 already applies to `lat`/`lng`.
   * Mutually exclusive with `lat`/`lng`/`radius` — both `parseSearchUrlState`
   * and `searchUrlStateToSearchParams` enforce that a bbox always wins
   * (§1.9: "setting a bbox... drops any existing lat/lng/radius"), so a
   * `SearchUrlState` never carries both after passing through either. */
  bboxNeLat?: number
  bboxNeLng?: number
  bboxSwLat?: number
  bboxSwLng?: number
}

/** The four corners of a map viewport, in the shape §1.5's "Search this
 * area"/search-as-I-move actions produce from the live map (as opposed to
 * `SearchUrlState`'s flat `bboxNeLat`/... fields, which are the URL/API
 * wire shape) — kept as its own small type so `applyBboxSearch`'s
 * signature reads as "here's a viewport," not "here are four
 * independent floats that happen to be related." */
export interface MapBoundingBox {
  neLat: number
  neLng: number
  swLat: number
  swLng: number
}

const PROPERTY_TYPE_VALUES = new Set<string>(PROPERTY_TYPE.options)
const FURNISHED_VALUES = new Set<string>(FURNISHED.options)
const SORT_VALUES = new Set<string>(SEARCH_SORT.options)
const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/

function parseIntParam(raw: string | null): number | undefined {
  if (raw === null || raw.trim() === '') return undefined
  if (!/^-?\d+$/.test(raw.trim())) return undefined
  return Number.parseInt(raw, 10)
}

function parseFloatParam(raw: string | null): number | undefined {
  if (raw === null || raw.trim() === '') return undefined
  const value = Number.parseFloat(raw)
  return Number.isFinite(value) ? value : undefined
}

function parseCommaListParam<T extends string>(
  raw: string | null,
  validValues: ReadonlySet<string>,
): T[] | undefined {
  if (raw === null || raw.trim() === '') return undefined
  const items = raw
    .split(',')
    .map((item) => item.trim())
    .filter((item): item is T => validValues.has(item))
  if (items.length === 0) return undefined
  return [...new Set(items)].sort() as T[]
}

/** Reads `searchParams` (the URL vocabulary, §1.7) into `SearchUrlState`.
 * Deliberately lenient, never throws: an unrecognised/malformed value
 * (a hand-edited or stale shared link) is dropped silently rather than
 * 400ing a page render, matching SRCH-1's "never an error page" spirit
 * applied to the whole results surface, not just the search box. */
export function parseSearchUrlState(
  searchParams: URLSearchParams,
): SearchUrlState {
  const state: SearchUrlState = {}

  const minPrice = parseIntParam(searchParams.get('minPrice'))
  if (minPrice !== undefined && minPrice >= 0) state.minPrice = minPrice

  const maxPrice = parseIntParam(searchParams.get('maxPrice'))
  if (maxPrice !== undefined && maxPrice >= 0) state.maxPrice = maxPrice

  const minBeds = parseIntParam(searchParams.get('minBeds'))
  if (minBeds !== undefined && minBeds >= 0 && minBeds <= 6) {
    state.minBeds = minBeds
  }

  const maxBeds = parseIntParam(searchParams.get('maxBeds'))
  if (maxBeds !== undefined && maxBeds >= 0 && maxBeds <= 6) {
    state.maxBeds = maxBeds
  }

  const type = parseCommaListParam<PropertyType>(
    searchParams.get('type'),
    PROPERTY_TYPE_VALUES,
  )
  if (type) state.type = type

  const furnished = parseCommaListParam<Furnished>(
    searchParams.get('furnished'),
    FURNISHED_VALUES,
  )
  if (furnished) state.furnished = furnished

  const availableFrom = searchParams.get('availableFrom')
  if (availableFrom && DATE_PATTERN.test(availableFrom)) {
    state.availableFrom = availableFrom
  }

  const sort = searchParams.get('sort')
  if (sort && SORT_VALUES.has(sort) && sort !== 'newest') {
    state.sort = sort as SearchSort
  }

  const page = parseIntParam(searchParams.get('page'))
  if (page !== undefined && page > 1) state.page = page

  // §1.9: a bbox (all four corners) always wins over a point-radius
  // search — parsed first so the lat/lng/radius block below can check
  // `hasBbox` and never set both on the same state.
  const bboxNeLat = parseFloatParam(searchParams.get('bboxNeLat'))
  const bboxNeLng = parseFloatParam(searchParams.get('bboxNeLng'))
  const bboxSwLat = parseFloatParam(searchParams.get('bboxSwLat'))
  const bboxSwLng = parseFloatParam(searchParams.get('bboxSwLng'))
  const hasBbox =
    bboxNeLat !== undefined &&
    bboxNeLng !== undefined &&
    bboxSwLat !== undefined &&
    bboxSwLng !== undefined
  if (hasBbox) {
    state.bboxNeLat = bboxNeLat
    state.bboxNeLng = bboxNeLng
    state.bboxSwLat = bboxSwLat
    state.bboxSwLng = bboxSwLng
  }

  const lat = parseFloatParam(searchParams.get('lat'))
  const lng = parseFloatParam(searchParams.get('lng'))
  if (!hasBbox && lat !== undefined && lng !== undefined) {
    state.lat = lat
    state.lng = lng
  }

  const radius = parseIntParam(searchParams.get('radius'))
  if (
    !hasBbox &&
    radius !== undefined &&
    SEARCH_RADIUS_MILES_OPTIONS.includes(radius)
  ) {
    state.radius = radius
  }

  const label = searchParams.get('label')
  if (label) state.label = label

  if (searchParams.get('view') === 'map') state.view = 'map'

  return state
}

/** Builds the canonical `URLSearchParams` for `state` — the inverse of
 * `parseSearchUrlState`, and the only place a URL is ever constructed
 * from state, so every caller (page links, filter Apply, pagination,
 * sort select, the header/hero combobox) produces the same canonical
 * shape. Default values are never emitted, even if passed explicitly. */
export function searchUrlStateToSearchParams(
  state: SearchUrlState,
): URLSearchParams {
  const params = new URLSearchParams()

  if (state.minPrice !== undefined) {
    params.set('minPrice', String(state.minPrice))
  }
  if (state.maxPrice !== undefined) {
    params.set('maxPrice', String(state.maxPrice))
  }
  if (state.minBeds !== undefined) {
    params.set('minBeds', String(state.minBeds))
  }
  if (state.maxBeds !== undefined) {
    params.set('maxBeds', String(state.maxBeds))
  }
  if (state.type && state.type.length > 0) {
    params.set('type', [...state.type].sort().join(','))
  }
  if (state.furnished && state.furnished.length > 0) {
    params.set('furnished', [...state.furnished].sort().join(','))
  }
  if (state.availableFrom) {
    params.set('availableFrom', state.availableFrom)
  }
  if (state.sort && state.sort !== 'newest') {
    params.set('sort', state.sort)
  }
  if (state.page !== undefined && state.page > 1) {
    params.set('page', String(state.page))
  }
  const hasBbox =
    state.bboxNeLat !== undefined &&
    state.bboxNeLng !== undefined &&
    state.bboxSwLat !== undefined &&
    state.bboxSwLng !== undefined

  // §1.9: mutually exclusive with a bbox — enforced defensively here too
  // (not just trusted from `parseSearchUrlState`'s own invariant), so this
  // function is self-correcting for any hand-built state that happens to
  // carry both.
  if (!hasBbox && state.lat !== undefined && state.lng !== undefined) {
    params.set('lat', String(state.lat))
    params.set('lng', String(state.lng))
  }
  if (!hasBbox && state.radius !== undefined) {
    params.set('radius', String(state.radius))
  }
  if (state.label) {
    params.set('label', state.label)
  }
  if (state.view === 'map') {
    params.set('view', 'map')
  }
  if (hasBbox) {
    params.set('bboxNeLat', String(state.bboxNeLat))
    params.set('bboxNeLng', String(state.bboxNeLng))
    params.set('bboxSwLat', String(state.bboxSwLat))
    params.set('bboxSwLng', String(state.bboxSwLng))
  }

  return params
}

/** `basePath` + the canonical query string for `state`, or bare
 * `basePath` when state has no non-default values — every internal link
 * this feature builds (filter Apply, chip removal, pagination, sort,
 * channel toggle) goes through this one function. */
export function buildSearchHref(
  basePath: string,
  state: SearchUrlState,
): string {
  const query = searchUrlStateToSearchParams(state).toString()
  return query ? `${basePath}?${query}` : basePath
}

function sortedEntries(params: URLSearchParams): string {
  return [...params.entries()]
    .map(([key, value]) => `${key}=${value}`)
    .sort()
    .join('&')
}

/**
 * Compares the *inbound* request's raw query string against the
 * canonical form of what it parses to. Returns:
 *  - `null` when the request is already canonical (no redirect needed —
 *    this includes both "genuinely no params" and "some params, all
 *    already minimal").
 *  - the canonical query string (possibly `''`) to redirect to otherwise.
 *
 * Order-independent: `?maxBeds=3&minBeds=1` and `?minBeds=1&maxBeds=3`
 * are the same canonical URL, not a redirect trigger — only a
 * *default-valued* param present in the raw request (`sort=newest`,
 * `page=1`) or an unrecognised/malformed param that parses away
 * triggers one, per §1.7's canonical-URL rule.
 */
export function needsCanonicalRedirect(
  rawParams: URLSearchParams,
): string | null {
  if ([...rawParams.keys()].length === 0) return null

  const canonical = searchUrlStateToSearchParams(parseSearchUrlState(rawParams))
  if (sortedEntries(canonical) === sortedEntries(rawParams)) return null

  return canonical.toString()
}

/**
 * Translates `state` (+ the current channel) into the raw string record
 * `lib/validation/search.ts`'s `searchQuerySchema` expects — the one
 * place site-vocabulary and API-vocabulary meet. Both the SSR initial
 * fetch (server pages call `searchQuerySchema.parse()` on this directly)
 * and the client re-query (`fetch('/api/v1/search?' + new
 * URLSearchParams(query))`) call this same function, so they can never
 * disagree about what a given URL state means.
 *
 * `furnished`: the search API accepts a single value
 * (`lib/validation/search.ts`'s `furnished: FURNISHED.optional()`) while
 * the URL/UI vocabulary supports a multi-select (§1.5, matching Type's
 * own checkbox-list pattern) for shareability and forward-compatibility.
 * **Documented deviation:** until the API grows OR-of-furnished-values
 * support, this only forwards the filter when exactly one value is
 * selected; 0 or 2+ selected values omit the API filter entirely (2+
 * reads as "no constraint" rather than an approximation, since silently
 * picking one of several user-selected values would filter out results
 * the user asked to see).
 */
/** An area landing page's server-side scope (M2-DESIGN-SPEC.md §4,
 * `lib/areas.ts`'s `AreaDefinition.match`) — deliberately the same flat
 * shape as that module's `AreaMatch` rather than importing it directly,
 * keeping this generic URL-vocabulary module free of a dependency on the
 * area *registry* (only the page/component layer that already knows
 * about `lib/areas.ts` needs to pass one in). */
export interface SearchAreaFilter {
  town?: string
  outcode?: string
}

export function buildSearchApiQuery(
  state: SearchUrlState,
  channel: Channel,
  areaFilter?: SearchAreaFilter,
): Record<string, string | undefined> {
  const query: Record<string, string | undefined> = { channel }
  if (areaFilter?.town) query.town = areaFilter.town
  if (areaFilter?.outcode) query.outcode = areaFilter.outcode

  if (state.minPrice !== undefined) query.priceMin = String(state.minPrice)
  if (state.maxPrice !== undefined) query.priceMax = String(state.maxPrice)
  if (state.minBeds !== undefined) query.bedsMin = String(state.minBeds)
  if (state.maxBeds !== undefined) query.bedsMax = String(state.maxBeds)
  if (state.type && state.type.length > 0) {
    query.types = [...state.type].sort().join(',')
  }

  if (channel === 'rent') {
    if (state.furnished && state.furnished.length === 1) {
      query.furnished = state.furnished[0]
    }
    if (state.availableFrom) query.availableBy = state.availableFrom
  }

  if (state.sort) query.sort = state.sort
  if (state.page !== undefined) query.page = String(state.page)

  // §1.9: a bbox always wins — `lat`/`lng`/`radius` are never forwarded
  // alongside one, even if a caller's state happens to carry both,
  // guaranteeing the API's own "a radius search or a bbox, not both"
  // 400 (`lib/validation/search.ts`) is unreachable through this
  // translation layer. `view` never reaches the API at all — it's a UI
  // lens, not a search filter.
  if (
    state.bboxNeLat !== undefined &&
    state.bboxNeLng !== undefined &&
    state.bboxSwLat !== undefined &&
    state.bboxSwLng !== undefined
  ) {
    query.bboxNeLat = String(state.bboxNeLat)
    query.bboxNeLng = String(state.bboxNeLng)
    query.bboxSwLat = String(state.bboxSwLat)
    query.bboxSwLng = String(state.bboxSwLng)
  } else if (state.lat !== undefined && state.lng !== undefined) {
    query.lat = String(state.lat)
    query.lng = String(state.lng)
    if (state.radius !== undefined) {
      query.radiusMiles = String(state.radius)
    }
  }

  return query
}

/**
 * M3-DESIGN-SPEC.md §1.3: "The map is never quietly capped to the list's
 * current page... the map plots every matching hit in the query" — the
 * map pane's own marker-layer fetch (results-view.tsx), completely
 * independent of the list column's own 24/page window
 * (`buildSearchApiQuery`'s own `state.page`, which continues to drive
 * only the list column + its Pagination, map-view.tsx §2.1).
 *
 * Built *from* `buildSearchApiQuery`, not a parallel reimplementation —
 * every filter/bbox/area-scope translation stays in that one function, so
 * "map and list return identical results for the same criteria" (PRD
 * §13) is structural: both requests are the exact same criteria, just
 * windowed differently. `page` is dropped entirely (never forwarded,
 * regardless of `state.page`) — the map is never itself paginated, so
 * there is no "which page" for it to ask the API for; `hitsPerPage` is
 * set to the display/fetch cap (`MAX_HITS_PER_PAGE`,
 * `lib/validation/search.ts`) so this always requests the largest window
 * the API allows in one call.
 */
export function buildMapSearchApiQuery(
  state: SearchUrlState,
  channel: Channel,
  areaFilter?: SearchAreaFilter,
): Record<string, string | undefined> {
  const query = buildSearchApiQuery(state, channel, areaFilter)
  delete query.page
  query.hitsPerPage = String(MAX_HITS_PER_PAGE)
  return query
}

/**
 * §1.5's bbox requery action (manual "Search this area," or a debounced
 * auto-mode `moveend`): replaces any existing `lat`/`lng`/`radius` with
 * the four bbox corners and resets `page` to 1 (omitted) — mirroring the
 * channel-toggle precedent (§3.2: "a filtered page 4... has no
 * meaningful equivalent") applied here to a changed geo constraint
 * rather than a changed channel. Every other field — filters, sort,
 * `view`, `label` — is preserved untouched: a bbox requery narrows
 * *where*, not *what*, and §1.5 is explicit that the breadcrumb/`<h1>`
 * (built from `label`) keep describing how the user arrived, unchanged.
 */
export function applyBboxSearch(
  state: SearchUrlState,
  bbox: MapBoundingBox,
): SearchUrlState {
  return {
    ...state,
    lat: undefined,
    lng: undefined,
    radius: undefined,
    bboxNeLat: bbox.neLat,
    bboxNeLng: bbox.neLng,
    bboxSwLat: bbox.swLat,
    bboxSwLng: bbox.swLng,
    page: undefined,
  }
}

/**
 * The channel-toggle reset rule (§1.2, stated precisely in §3.2):
 * **preserved** — location (lat/lng/radius/label), minBeds/maxBeds, type,
 * sort. **Reset to default** — minPrice/maxPrice (a sale price has no
 * honest rent equivalent) and page (a filtered page 4 on Buy has no
 * meaningful equivalent on Rent). **Dropped entirely** — furnished,
 * availableFrom (channel-specific, meaningless on the other channel).
 *
 * M3 extension (M3-DESIGN-SPEC.md §1.9): `view` and the bbox corners are
 * also preserved. `view` is a channel-independent UI lens (whether
 * you're looking at a map has nothing to do with Buy vs Rent); a bbox is
 * a location constraint exactly like lat/lng/radius, already preserved
 * above for the same reason.
 */
/** Converts a Next.js page's resolved `searchParams` prop (a plain
 * object, possibly with `string[]` values for a repeated key) into a
 * `URLSearchParams` instance — the shape every other function in this
 * module works with. A repeated key keeps only its first value (this
 * app never intentionally repeats a query key; `URLSearchParams` itself
 * has no other sane way to represent one under a single-value param
 * vocabulary like this one). */
export function nextSearchParamsToURLSearchParams(
  raw: Record<string, string | string[] | undefined>,
): URLSearchParams {
  const params = new URLSearchParams()
  for (const [key, value] of Object.entries(raw)) {
    if (value === undefined) continue
    params.set(key, Array.isArray(value) ? value[0] : value)
  }
  return params
}

export function resetStateForChannelSwitch(
  state: SearchUrlState,
): SearchUrlState {
  const preserved: SearchUrlState = {}
  if (state.lat !== undefined) preserved.lat = state.lat
  if (state.lng !== undefined) preserved.lng = state.lng
  if (state.radius !== undefined) preserved.radius = state.radius
  if (state.label !== undefined) preserved.label = state.label
  if (state.minBeds !== undefined) preserved.minBeds = state.minBeds
  if (state.maxBeds !== undefined) preserved.maxBeds = state.maxBeds
  if (state.type !== undefined) preserved.type = state.type
  if (state.sort !== undefined) preserved.sort = state.sort
  if (state.view !== undefined) preserved.view = state.view
  if (state.bboxNeLat !== undefined) preserved.bboxNeLat = state.bboxNeLat
  if (state.bboxNeLng !== undefined) preserved.bboxNeLng = state.bboxNeLng
  if (state.bboxSwLat !== undefined) preserved.bboxSwLat = state.bboxSwLat
  if (state.bboxSwLng !== undefined) preserved.bboxSwLng = state.bboxSwLng
  return preserved
}

/**
 * True when `state` carries at least one *filter* (a chip in §1.1's
 * sense: price, beds, type, furnished or available-from) — as opposed to
 * sort, page or a `/search`-tier location, none of which render as a
 * filter chip. Used by the area landing page (§4.1) to decide whether
 * it's still showing "the area page" (intro copy + newest strip visible)
 * or has become "results for this area with a filter applied" (those
 * sections stop rendering).
 */
export function hasActiveSearchFilters(state: SearchUrlState): boolean {
  return (
    state.minPrice !== undefined ||
    state.maxPrice !== undefined ||
    state.minBeds !== undefined ||
    state.maxBeds !== undefined ||
    (state.type?.length ?? 0) > 0 ||
    (state.furnished?.length ?? 0) > 0 ||
    state.availableFrom !== undefined
  )
}

/** §3.8's empty-state link target: "the unrestricted-for-this-area URL
 * (all filters stripped, location kept)." Keeps only the point/label
 * that identifies *where* the search is, dropping every filter, sort
 * and page. */
export function stripFiltersKeepLocation(
  state: SearchUrlState,
): SearchUrlState {
  const preserved: SearchUrlState = {}
  if (state.lat !== undefined) preserved.lat = state.lat
  if (state.lng !== undefined) preserved.lng = state.lng
  if (state.radius !== undefined) preserved.radius = state.radius
  if (state.label !== undefined) preserved.label = state.label
  return preserved
}
