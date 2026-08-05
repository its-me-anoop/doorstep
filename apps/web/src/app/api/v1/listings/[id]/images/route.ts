/**
 * POST /api/v1/listings/{id}/images — PRD §10: "Signed upload URL" (PRD
 * §6.5 LST-3's "uploads go directly to storage via short-lived signed
 * URLs"). Body `{ contentType, bytes }`, validated against
 * lib/validation/image.ts's requestImageUploadSchema — `bytes` is the
 * client's declared upload size, used only for early rejection (see that
 * schema's doc comment for why the real size ceiling is enforced
 * elsewhere). Nothing is persisted by this route: no property_images row
 * exists until POST .../images/{imageId}/process succeeds after the
 * client's PUT to the returned uploadUrl completes — hence 200, not 201
 * (PRD §8.7 point 1).
 *
 * Thin per PRD §8.5: resolve the session, parse the body, call
 * RequestImageUpload, map the result to `{ data: { imageId, uploadUrl,
 * path, headers? } }`.
 */

import { NextResponse, type NextRequest } from 'next/server'

import { apiError } from '@/lib/api-error'
import { createServices } from '@/lib/composition'
import { mapCommonListingError } from '@/lib/listing-api-errors'
import { resolveSessionUser } from '@/lib/resolve-session-user'
import { SESSION_COOKIE_NAME } from '@/lib/session-cookie-name'
import { requestImageUploadSchema } from '@/lib/validation/image'
import { TooManyImagesError } from '@/services/images'

interface RouteContext {
  params: Promise<{ id: string }>
}

export async function POST(
  request: NextRequest,
  { params }: RouteContext,
): Promise<NextResponse> {
  if (!request.cookies.get(SESSION_COOKIE_NAME)?.value) {
    return apiError(401, 'unauthenticated', 'Sign in to continue.')
  }

  const rawBody: unknown = await request.json().catch(() => null)
  const parsed = requestImageUploadSchema.safeParse(rawBody)
  if (!parsed.success) {
    return apiError(
      400,
      'invalid_request',
      parsed.error.issues[0]?.message ?? 'Invalid request body',
    )
  }

  const { auth, images } = createServices()

  try {
    const actor = await resolveSessionUser(request, auth.getCurrentUser)
    if (!actor) return apiError(401, 'unauthenticated', 'Sign in to continue.')

    const { id } = await params
    const result = await images.requestImageUpload.execute(
      actor,
      id,
      parsed.data,
    )
    return NextResponse.json({ data: result })
  } catch (error) {
    if (error instanceof TooManyImagesError) {
      return apiError(409, 'too_many_images', error.message)
    }
    const mapped = mapCommonListingError(error)
    if (mapped) return mapped
    console.error('POST /api/v1/listings/[id]/images failed:', error)
    return apiError(500, 'internal_error', 'Something went wrong on our side')
  }
}
