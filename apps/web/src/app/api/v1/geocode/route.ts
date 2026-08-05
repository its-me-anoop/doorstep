/**
 * GET /api/v1/geocode?q= — PRD §10: "Suggestions: postcode fast-path +
 * Mapbox place results". Public — no session required. M1 scope is the
 * postcode fast path only: a query that isn't a recognisable UK postcode
 * or outcode resolves to no results rather than an error (see
 * adapters/postcodesio/'s doc comment) — full-text Mapbox place
 * suggestions are TODO(M2), tracked there and in
 * services/geocoding/search-geocode.ts's doc comment, not built here.
 *
 * Thin per PRD §8.5: parse `q` with zod, call SearchGeocode, map the
 * result to `{ data: { results } }` — plural, matching the PRD's
 * "Suggestions" framing even though M1 only ever returns 0 or 1 result.
 */

import { NextResponse, type NextRequest } from 'next/server'
import { z } from 'zod'

import { apiError } from '@/lib/api-error'
import { createServices } from '@/lib/composition'

const geocodeQuerySchema = z.object({
  q: z.string().trim().min(1, 'q is required'),
})

export async function GET(request: NextRequest): Promise<NextResponse> {
  const parsed = geocodeQuerySchema.safeParse({
    q: request.nextUrl.searchParams.get('q') ?? undefined,
  })
  if (!parsed.success) {
    return apiError(
      400,
      'invalid_request',
      parsed.error.issues[0]?.message ?? 'Invalid request',
    )
  }

  const { geocoding } = createServices()

  try {
    const results = await geocoding.searchGeocode.execute(parsed.data.q)
    return NextResponse.json({ data: { results } })
  } catch (error) {
    console.error('GET /api/v1/geocode failed:', error)
    return apiError(500, 'internal_error', 'Something went wrong on our side')
  }
}
