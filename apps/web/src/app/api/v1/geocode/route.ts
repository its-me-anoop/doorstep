/**
 * GET /api/v1/geocode?q= — PRD §10 SRCH-1: "Suggestions: postcode
 * fast-path + Mapbox place results". Public — no session required.
 *
 * Thin per PRD §8.5: parse `q` with zod, call SearchGeocode, map the
 * result to `{ data: { version: 2, results } }`.
 *
 * **Doc-shape v2**: M1 returned `{ data: { results: GeocodeResult[] } }`
 * — an undiscriminated array with 0 or 1 entries (the postcode fast path
 * only). M2 adds the free-text place fallback (services/geocoding/
 * search-geocode.ts), so `results` can now hold several entries of two
 * different shapes; `version: 2` and each result's own `kind` field
 * (`'postcode' | 'place'`) are the version bump this represents — a
 * client written against v1's implicit "always 0-or-1, always the same
 * shape" assumption needs updating, hence the explicit version marker
 * rather than a silent shape change.
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
    return NextResponse.json({ data: { version: 2, results } })
  } catch (error) {
    console.error('GET /api/v1/geocode failed:', error)
    return apiError(500, 'internal_error', 'Something went wrong on our side')
  }
}
