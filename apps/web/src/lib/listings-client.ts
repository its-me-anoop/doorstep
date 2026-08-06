/**
 * lib/listings-client.ts — the browser-side calls behind the
 * create-listing wizard (PRD §6.5 LST-2, M1-DESIGN-SPEC.md §3) and the
 * my-listings dashboard (PRD §6.5 LST-5, M1-DESIGN-SPEC.md §4): the
 * create-draft POST, the wizard's autosave PATCH, the final submit POST,
 * the postcode-lookup GET, the dashboard's own listing/page fetch, its
 * one-click status-transition POST, and its delete-draft DELETE. Mirrors
 * lib/onboarding-client.ts's shape (a typed error class + one `request`
 * helper unwrapping the `{ error: { code, message } }` envelope,
 * lib/api-error.ts) rather than introducing a second convention.
 *
 * Unlike onboarding's routes, every listings route already returns a
 * specific, human-readable `message` in its error envelope (the zod
 * issue message, or a service's own error text) rather than a generic
 * code the client has to map — see lib/validation/listing.ts's per-field
 * messages and services/listings/errors.ts. So ListingsApiError surfaces
 * that message directly; there is no FRIENDLY_MESSAGES lookup table to
 * duplicate here, only a fallback for the rare envelope that omits one
 * (a 5xx from an unexpected throw, mapped by the route's generic catch).
 */

import type { DraftListingInput } from './validation/listing'
import type { Listing, ListingCursorPage } from '@/ports/listing-repository'
import type { GeocodeSuggestion } from '@/services/geocoding/search-geocode'
import type { ListingStatusAction } from '@/services/listings/change-listing-status'

export class ListingsApiError extends Error {
  constructor(
    public readonly code: string,
    message: string,
  ) {
    super(message)
    this.name = 'ListingsApiError'
  }
}

const GENERIC_MESSAGE =
  'Something went wrong on our end — try again in a moment.'

interface ApiEnvelope<T> {
  data?: T
  error?: { code?: string; message?: string }
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(path, init)
  const json: ApiEnvelope<T> | null = await response.json().catch(() => null)

  if (!response.ok) {
    throw new ListingsApiError(
      json?.error?.code ?? 'internal_error',
      json?.error?.message ?? GENERIC_MESSAGE,
    )
  }

  return json?.data as T
}

function postJson<T>(path: string, body: unknown): Promise<T> {
  return request<T>(path, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
}

/** POST /api/v1/listings — creates the draft the wizard immediately
 * routes into (M1-DESIGN-SPEC.md §3, wizard shell). */
export async function createDraftListing(
  input: Partial<DraftListingInput>,
): Promise<Listing> {
  const { listing } = await postJson<{ listing: Listing }>(
    '/api/v1/listings',
    input,
  )
  return listing
}

/** PATCH /api/v1/listings/{id} — the wizard's autosave (§3.0): lenient,
 * whatever the form currently holds. */
export async function patchListing(
  id: string,
  input: Partial<DraftListingInput>,
): Promise<Listing> {
  const { listing } = await request<{ listing: Listing }>(
    `/api/v1/listings/${id}`,
    {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(input),
    },
  )
  return listing
}

/** POST /api/v1/listings/{id}/submit — step 6's "Submit for approval"
 * (§3.6). No body: completeness is judged against the *stored* listing
 * server-side (services/listings/submit-listing.ts). */
export async function submitListing(id: string): Promise<Listing> {
  const { listing } = await request<{ listing: Listing }>(
    `/api/v1/listings/${id}/submit`,
    { method: 'POST' },
  )
  return listing
}

/** GET /api/v1/geocode?q= — step 2's "Find address" (§3.2) and, on the
 * buyer side, the search combobox's suggestion dropdown
 * (M2-DESIGN-SPEC.md §1.9, reused verbatim per that section's own "no
 * new geocode client" instruction). Doc-shape v2 (see the route's own
 * comment): each entry is a `GeocodeSuggestion`, tagged `kind: 'postcode'
 * | 'place'` — the return type was `GeocodeResult[]` (the v1, undiscriminated
 * shape) until this M2 change; `GeocodeSuggestion` is a structural
 * superset of the fields v1 callers (step-address.tsx) already read
 * (`lat`, `lng`, `label`, `outcode`), so this is a type-accuracy fix, not
 * a breaking change for them. */
export async function geocodeSearch(
  query: string,
): Promise<GeocodeSuggestion[]> {
  const { results } = await request<{ results: GeocodeSuggestion[] }>(
    `/api/v1/geocode?q=${encodeURIComponent(query)}`,
  )
  return results
}

/** POST /api/v1/listings/{id}/status — the dashboard's one-click status
 * transitions (M1-DESIGN-SPEC.md §4.3/§4.4): Mark Sold STC/Let Agreed,
 * Mark Sold/Let, Hide, Unhide, Back on market. The caller fires this
 * immediately alongside its own optimistic paint, per §4.4's
 * implementation note — it never waits for the 6-second undo window. */
export function changeListingStatus(
  id: string,
  action: ListingStatusAction,
): Promise<Listing> {
  return postJson<{ listing: Listing }>(`/api/v1/listings/${id}/status`, {
    action,
  }).then(({ listing }) => listing)
}

/** DELETE /api/v1/listings/{id} — the dashboard's "Delete draft" inline
 * confirm (§4.3/§4.4), the API's one hard delete. No body, and the
 * envelope's `data` carries no listing to unwrap (there is nothing left
 * to return), unlike this file's other calls. */
export async function deleteListing(id: string): Promise<void> {
  await request<{ deleted: true }>(`/api/v1/listings/${id}`, {
    method: 'DELETE',
  })
}

export interface ListMyListingsOptions {
  cursor?: string | null
  limit?: number
}

/** GET /api/v1/listings — the dashboard's "Load more" cursor pagination
 * (§4). Deliberately doesn't go through this file's `request` helper:
 * that helper's `ApiEnvelope` only ever unwraps a nested `data.<key>`
 * object (every other route in this file returns `{ data: { listing } }`
 * or similar); this route's own envelope is `{ data, nextCursor }` with
 * `data` itself the listing array (app/api/v1/listings/route.ts's own
 * doc comment explains why), so this call parses that shape directly
 * rather than bending the shared helper's contract for one route. */
export async function listMyListings(
  options: ListMyListingsOptions = {},
): Promise<ListingCursorPage<Listing>> {
  const params = new URLSearchParams()
  if (options.cursor) params.set('cursor', options.cursor)
  if (options.limit !== undefined) params.set('limit', String(options.limit))
  const query = params.toString()

  const response = await fetch(
    `/api/v1/listings${query ? `?${query}` : ''}`,
    undefined,
  )
  const json: {
    data?: Listing[]
    nextCursor?: string | null
    error?: { code?: string; message?: string }
  } | null = await response.json().catch(() => null)

  if (!response.ok) {
    throw new ListingsApiError(
      json?.error?.code ?? 'internal_error',
      json?.error?.message ?? GENERIC_MESSAGE,
    )
  }

  return { data: json?.data ?? [], nextCursor: json?.nextCursor ?? null }
}
