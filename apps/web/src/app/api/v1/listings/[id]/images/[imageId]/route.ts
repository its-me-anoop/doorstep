/**
 * PATCH/DELETE /api/v1/listings/{id}/images/{imageId} — PRD §10: "reorder;
 * set kind; delete" (PRD §6.5 LST-3). PATCH body `{ position?, kind? }`,
 * validated against lib/validation/image.ts's updateImageSchema (at least
 * one of the two must be present).
 *
 * PATCH deliberately calls two separate services — ReorderImages for
 * `position`, SetImageKind for `kind` — rather than one merged "update
 * image" use case, matching the task that defined them as two SRP-focused
 * services. When both fields are present in one request, both services
 * run in sequence and the SECOND call's result is what's returned; this
 * still reflects both changes correctly (each service's
 * PropertyImageWriter method reads/writes the current row, so the second
 * call sees the first call's already-persisted change) — see
 * ReorderImages/SetImageKind's doc comments. The cost is each service
 * re-running its own listing lookup and object-level authz check when
 * both fields are sent together; accepted here for the same reason
 * services/listings/* tolerates the identical repeated
 * lookup-then-authz block across six separate services rather than
 * extracting a shared helper — each use case stays fully self-contained
 * and independently testable.
 *
 * Thin per PRD §8.5: resolve the session, parse the body, call the
 * relevant service(s)/DeleteImage, map the result.
 */

import { NextResponse, type NextRequest } from 'next/server'

import { apiError } from '@/lib/api-error'
import { createServices } from '@/lib/composition'
import { mapCommonListingError } from '@/lib/listing-api-errors'
import { resolveSessionUser } from '@/lib/resolve-session-user'
import { SESSION_COOKIE_NAME } from '@/lib/session-cookie-name'
import { updateImageSchema } from '@/lib/validation/image'
import { PropertyImageNotFoundError } from '@/ports/property-image-repository'

interface RouteContext {
  params: Promise<{ id: string; imageId: string }>
}

export async function PATCH(
  request: NextRequest,
  { params }: RouteContext,
): Promise<NextResponse> {
  if (!request.cookies.get(SESSION_COOKIE_NAME)?.value) {
    return apiError(401, 'unauthenticated', 'Sign in to continue.')
  }

  const rawBody: unknown = await request.json().catch(() => null)
  const parsed = updateImageSchema.safeParse(rawBody)
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

    const { id, imageId } = await params
    let image
    if (parsed.data.position !== undefined) {
      image = await images.reorderImages.execute(
        actor,
        id,
        imageId,
        parsed.data.position,
      )
    }
    if (parsed.data.kind !== undefined) {
      image = await images.setImageKind.execute(
        actor,
        id,
        imageId,
        parsed.data.kind,
      )
    }
    return NextResponse.json({ data: { image } })
  } catch (error) {
    if (error instanceof PropertyImageNotFoundError) {
      return apiError(404, 'not_found', error.message)
    }
    const mapped = mapCommonListingError(error)
    if (mapped) return mapped
    console.error('PATCH /api/v1/listings/[id]/images/[imageId] failed:', error)
    return apiError(500, 'internal_error', 'Something went wrong on our side')
  }
}

export async function DELETE(
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
    await images.deleteImage.execute(actor, id, imageId)
    return NextResponse.json({ data: { deleted: true } })
  } catch (error) {
    if (error instanceof PropertyImageNotFoundError) {
      return apiError(404, 'not_found', error.message)
    }
    const mapped = mapCommonListingError(error)
    if (mapped) return mapped
    console.error(
      'DELETE /api/v1/listings/[id]/images/[imageId] failed:',
      error,
    )
    return apiError(500, 'internal_error', 'Something went wrong on our side')
  }
}
