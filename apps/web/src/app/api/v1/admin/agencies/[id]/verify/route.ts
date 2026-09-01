/**
 * POST /api/v1/admin/agencies/{id}/verify — mark agency verified (ADM-3).
 */

import { NextResponse, type NextRequest } from 'next/server'

import { apiError } from '@/lib/api-error'
import { createServices } from '@/lib/composition'
import { mapCommonApiError } from '@/lib/map-common-api-error'
import { resolveSessionUser } from '@/lib/resolve-session-user'
import { SESSION_COOKIE_NAME } from '@/lib/session-cookie-name'

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
  const body =
    rawBody && typeof rawBody === 'object'
      ? (rawBody as { verified?: unknown; reason?: unknown })
      : {}

  const { auth, admin } = createServices()

  try {
    const actor = await resolveSessionUser(request, auth.getCurrentUser)
    if (!actor) return apiError(401, 'unauthenticated', 'Sign in to continue.')

    const { id } = await params
    const agency = await admin.verifyAgency.execute(
      actor,
      id,
      body.verified !== false,
      body.reason != null ? String(body.reason) : null,
    )

    return NextResponse.json({ data: { agency } })
  } catch (error) {
    const mapped = mapCommonApiError(error)
    if (mapped) return mapped

    console.error('POST /api/v1/admin/agencies/[id]/verify failed:', error)
    return apiError(500, 'internal_error', 'Something went wrong on our side')
  }
}
