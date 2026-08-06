/**
 * The browser-side call behind GET /api/v1/search — used by the results
 * view's client-side re-query on filter/sort/page change
 * (M2-DESIGN-SPEC.md §1.10 point 2) and by the outage panel's "Try
 * again" button (point 4). Mirrors lib/listings-client.ts's
 * `ApiError`+`request` shape rather than inventing a second envelope
 * convention; kept as its own file (not added to listings-client.ts)
 * because it has a distinct public error surface — callers specifically
 * branch on `SearchApiError.code === 'search_unavailable'` to render the
 * outage panel, which `ListingsApiError`'s consumers never need to do.
 */

import type { PublicSearchResult } from '@/services/search/search-listings'

export class SearchApiError extends Error {
  constructor(
    public readonly code: string,
    message: string,
  ) {
    super(message)
    this.name = 'SearchApiError'
  }
}

const GENERIC_MESSAGE =
  'Something went wrong on our end — try again in a moment.'

interface ApiEnvelope<T> {
  data?: T
  error?: { code?: string; message?: string }
}

function toQueryString(query: Record<string, string | undefined>): string {
  const params = new URLSearchParams()
  for (const [key, value] of Object.entries(query)) {
    if (value !== undefined) params.set(key, value)
  }
  return params.toString()
}

/** GET /api/v1/search?{query} — `query` is exactly
 * `lib/search-url.ts`'s `buildSearchApiQuery` output, so this function
 * never re-derives param names itself. */
export async function fetchSearchResults(
  query: Record<string, string | undefined>,
): Promise<PublicSearchResult> {
  const qs = toQueryString(query)
  const response = await fetch(`/api/v1/search${qs ? `?${qs}` : ''}`)
  const json: ApiEnvelope<PublicSearchResult> | null = await response
    .json()
    .catch(() => null)

  if (!response.ok) {
    throw new SearchApiError(
      json?.error?.code ?? 'internal_error',
      json?.error?.message ?? GENERIC_MESSAGE,
    )
  }

  return json?.data as PublicSearchResult
}
