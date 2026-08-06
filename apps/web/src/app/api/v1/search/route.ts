/**
 * GET /api/v1/search — PRD §10: "Listing search: channel, geo (point+radius
 * or bbox), filters, sort, pagination." Public — no session required (PRD
 * §8.4's capability matrix: browsing/searching published listings is a
 * guest capability).
 *
 * Thin per PRD §8.5: build a plain query-params record off
 * `request.nextUrl.searchParams`, safeParse it against
 * lib/validation/search.ts's searchQuerySchema, call SearchListings, map
 * the result. `SearchUnavailableError` gets its own 503 branch (PRD
 * §7.6's graceful degradation) ahead of the generic 500 fallback — every
 * other thrown error is treated as this route's own bug/infrastructure
 * failure, not a client-facing outage state.
 */

import { NextResponse, type NextRequest } from 'next/server'

import { apiError } from '@/lib/api-error'
import { createServices } from '@/lib/composition'
import { searchQuerySchema } from '@/lib/validation/search'
import { SearchUnavailableError } from '@/services/search'

/** Every field searchQuerySchema knows about, read as a raw string (or
 * `undefined` when absent) — safeParse itself does every coercion/bound
 * check, so this is a flat, mechanical read, not a second parsing step. */
const QUERY_PARAM_NAMES = [
  'channel',
  'lat',
  'lng',
  'radiusMiles',
  'bboxNeLat',
  'bboxNeLng',
  'bboxSwLat',
  'bboxSwLng',
  'priceMin',
  'priceMax',
  'bedsMin',
  'bedsMax',
  'bathsMin',
  'types',
  'tenure',
  'furnished',
  'availableBy',
  'newHome',
  'town',
  'outcode',
  'sort',
  'page',
  'hitsPerPage',
] as const

function readQueryParams(
  searchParams: URLSearchParams,
): Record<string, string | undefined> {
  const raw: Record<string, string | undefined> = {}
  for (const name of QUERY_PARAM_NAMES) {
    raw[name] = searchParams.get(name) ?? undefined
  }
  return raw
}

export async function GET(request: NextRequest): Promise<NextResponse> {
  const parsed = searchQuerySchema.safeParse(
    readQueryParams(request.nextUrl.searchParams),
  )
  if (!parsed.success) {
    return apiError(
      400,
      'invalid_request',
      parsed.error.issues[0]?.message ?? 'Invalid request',
    )
  }

  const { search } = createServices()

  try {
    const result = await search.searchListings.execute(parsed.data)
    return NextResponse.json({ data: result })
  } catch (error) {
    if (error instanceof SearchUnavailableError) {
      return apiError(
        503,
        'search_unavailable',
        'Search is temporarily unavailable. Please try again shortly.',
      )
    }
    console.error('GET /api/v1/search failed:', error)
    return apiError(500, 'internal_error', 'Something went wrong on our side')
  }
}
