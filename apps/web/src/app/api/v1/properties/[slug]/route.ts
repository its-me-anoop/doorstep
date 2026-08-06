/**
 * GET /api/v1/properties/{slug} — PRD §10: "Listing detail (published or
 * under offer only)." Public — no session required (PRD §8.4: browsing a
 * published listing is a guest capability), the same shape as GET
 * /api/v1/search's route handler.
 *
 * Thin per PRD §8.5: call GetPublicListing with the path segment, map the
 * result. `PublicListingNotFoundError` gets its own 404 branch — the same
 * error whether the slug is unknown or the listing exists but isn't
 * publicly visible (see that error's own doc comment).
 */

import { NextResponse, type NextRequest } from 'next/server'

import { apiError } from '@/lib/api-error'
import { createServices } from '@/lib/composition'
import { PublicListingNotFoundError } from '@/services/listings/errors'

interface RouteContext {
  params: Promise<{ slug: string }>
}

export async function GET(
  _request: NextRequest,
  { params }: RouteContext,
): Promise<NextResponse> {
  const { listings } = createServices()
  const { slug } = await params

  try {
    const listing = await listings.getPublicListing.execute(slug)
    return NextResponse.json({ data: { listing } })
  } catch (error) {
    if (error instanceof PublicListingNotFoundError) {
      return apiError(404, 'not_found', error.message)
    }
    console.error('GET /api/v1/properties/[slug] failed:', error)
    return apiError(500, 'internal_error', 'Something went wrong on our side')
  }
}
