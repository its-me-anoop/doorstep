/**
 * POST /api/v1/listings/{id}/images/{imageId}/process — PRD §10, called
 * by the client immediately after its PUT to POST
 * .../images's uploadUrl completes (PRD §8.7 point 2: sharp variants,
 * EXIF strip, blurhash, the property_images row). No request body — the
 * original to process is entirely identified by the two path segments.
 *
 * Thin per PRD §8.5: resolve the session, call ProcessImage, map the
 * result to `{ data: { image } }` (matching this API's `{ data: { listing
 * } }` single-resource convention elsewhere, rather than returning the
 * image unwrapped at the top level).
 */

import { NextResponse, type NextRequest } from 'next/server'

import { apiError } from '@/lib/api-error'
import { createServices } from '@/lib/composition'
import { mapCommonListingError } from '@/lib/listing-api-errors'
import { resolveSessionUser } from '@/lib/resolve-session-user'
import { SESSION_COOKIE_NAME } from '@/lib/session-cookie-name'
import { OriginalImageNotFoundError } from '@/services/images'

interface RouteContext {
  params: Promise<{ id: string; imageId: string }>
}

export async function POST(
  request: NextRequest,
  { params }: RouteContext,
): Promise<NextResponse> {
  if (!request.cookies.get(SESSION_COOKIE_NAME)?.value) {
    return apiError(401, 'unauthenticated', 'Sign in to continue.')
  }

  const { auth, images } = createServices()

  try {
    const actor = await resolveSessionUser(request, auth.getCurrentUser)
    if (!actor) return apiError(401, 'unauthenticated', 'Sign in to continue.')

    const { id, imageId } = await params
    const image = await images.processImage.execute(actor, id, imageId)
    return NextResponse.json({ data: { image } })
  } catch (error) {
    if (error instanceof OriginalImageNotFoundError) {
      return apiError(404, 'original_not_found', error.message)
    }
    const mapped = mapCommonListingError(error)
    if (mapped) return mapped
    console.error(
      'POST /api/v1/listings/[id]/images/[imageId]/process failed:',
      error,
    )
    return apiError(500, 'internal_error', 'Something went wrong on our side')
  }
}
