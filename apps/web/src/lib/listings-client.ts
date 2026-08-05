/**
 * lib/listings-client.ts — the browser-side calls behind the
 * create-listing wizard (PRD §6.5 LST-2, M1-DESIGN-SPEC.md §3): the
 * create-draft POST, the wizard's autosave PATCH, the final submit POST
 * and the postcode-lookup GET. Mirrors lib/onboarding-client.ts's shape
 * (a typed error class + one `request` helper unwrapping the
 * `{ error: { code, message } }` envelope, lib/api-error.ts) rather than
 * introducing a second convention.
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
import type { Listing } from '@/ports/listing-repository'
import type { GeocodeResult } from '@/ports/geocoder'

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

/** GET /api/v1/geocode?q= — step 2's "Find address" (§3.2). Always an
 * array (0 or 1 result in M1's postcode-only fast path — see
 * SearchGeocode's own doc comment). */
export async function geocodeSearch(query: string): Promise<GeocodeResult[]> {
  const { results } = await request<{ results: GeocodeResult[] }>(
    `/api/v1/geocode?q=${encodeURIComponent(query)}`,
  )
  return results
}
