/**
 * PUT /api/v1/me/saved-properties/{propertyId} — save favourite.
 * DELETE — remove favourite (PRD §6.3 ACC-2).
 */

import { NextResponse, type NextRequest } from 'next/server'

import { apiError } from '@/lib/api-error'
import { createServices } from '@/lib/composition'
import { mapCommonApiError } from '@/lib/map-common-api-error'
import { resolveSessionUser } from '@/lib/resolve-session-user'
import { SESSION_COOKIE_NAME } from '@/lib/session-cookie-name'

interface RouteContext {
  params: Promise<{ propertyId: string }>
}

export async function PUT(
  request: NextRequest,
  { params }: RouteContext,
): Promise<NextResponse> {
  if (!request.cookies.get(SESSION_COOKIE_NAME)?.value) {
    return apiError(401, 'unauthenticated', 'Sign in to continue.')
  }

  const { auth, saved } = createServices()

  try {
    const actor = await resolveSessionUser(request, auth.getCurrentUser)
    if (!actor) return apiError(401, 'unauthenticated', 'Sign in to continue.')

    const { propertyId } = await params
    const savedProperty = await saved.saveProperty.execute(actor, propertyId)
    return NextResponse.json({ data: { savedProperty } })
  } catch (error) {
    const mapped = mapCommonApiError(error)
    if (mapped) return mapped

    console.error('PUT /api/v1/me/saved-properties/[propertyId] failed:', error)
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

  const { auth, saved } = createServices()

  try {
    const actor = await resolveSessionUser(request, auth.getCurrentUser)
    if (!actor) return apiError(401, 'unauthenticated', 'Sign in to continue.')

    const { propertyId } = await params
    await saved.unsaveProperty.execute(actor, propertyId)
    return NextResponse.json({ data: { ok: true } })
  } catch (error) {
    const mapped = mapCommonApiError(error)
    if (mapped) return mapped

    console.error(
      'DELETE /api/v1/me/saved-properties/[propertyId] failed:',
      error,
    )
    return apiError(500, 'internal_error', 'Something went wrong on our side')
  }
}
