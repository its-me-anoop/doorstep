/**
 * GET /api/v1/admin/users — search users (?q=).
 * PATCH — suspend/reinstate/ban/set_role (ADM-3).
 */

import { NextResponse, type NextRequest } from 'next/server'

import type { UserRole } from '@/domain/enums'
import { apiError } from '@/lib/api-error'
import { createServices } from '@/lib/composition'
import { mapCommonApiError } from '@/lib/map-common-api-error'
import { resolveSessionUser } from '@/lib/resolve-session-user'
import { SESSION_COOKIE_NAME } from '@/lib/session-cookie-name'
import type { ManageUserAction } from '@/services/admin'

const VALID_ACTIONS: ReadonlySet<ManageUserAction> = new Set([
  'suspend',
  'reinstate',
  'ban',
  'set_role',
])

export async function GET(request: NextRequest): Promise<NextResponse> {
  if (!request.cookies.get(SESSION_COOKIE_NAME)?.value) {
    return apiError(401, 'unauthenticated', 'Sign in to continue.')
  }

  const { auth, admin } = createServices()

  try {
    const actor = await resolveSessionUser(request, auth.getCurrentUser)
    if (!actor) return apiError(401, 'unauthenticated', 'Sign in to continue.')

    const q = request.nextUrl.searchParams.get('q') ?? undefined
    const cursor = request.nextUrl.searchParams.get('cursor')
    const limitRaw = request.nextUrl.searchParams.get('limit')
    const limit = limitRaw ? Number.parseInt(limitRaw, 10) : undefined

    const page = await admin.searchUsers.execute(actor, {
      q,
      cursor,
      limit: Number.isFinite(limit) ? limit : undefined,
    })

    return NextResponse.json({ data: page.data, nextCursor: page.nextCursor })
  } catch (error) {
    const mapped = mapCommonApiError(error)
    if (mapped) return mapped

    console.error('GET /api/v1/admin/users failed:', error)
    return apiError(500, 'internal_error', 'Something went wrong on our side')
  }
}

export async function PATCH(request: NextRequest): Promise<NextResponse> {
  if (!request.cookies.get(SESSION_COOKIE_NAME)?.value) {
    return apiError(401, 'unauthenticated', 'Sign in to continue.')
  }

  const rawBody: unknown = await request.json().catch(() => null)
  if (!rawBody || typeof rawBody !== 'object') {
    return apiError(400, 'invalid_request', 'Invalid request body')
  }

  const body = rawBody as {
    userId?: unknown
    action?: unknown
    role?: unknown
    reason?: unknown
  }

  if (typeof body.userId !== 'string' || !body.userId.trim()) {
    return apiError(400, 'validation_error', 'userId is required.')
  }

  if (
    typeof body.action !== 'string' ||
    !VALID_ACTIONS.has(body.action as ManageUserAction)
  ) {
    return apiError(400, 'validation_error', 'Invalid action.')
  }

  const { auth, admin } = createServices()

  try {
    const actor = await resolveSessionUser(request, auth.getCurrentUser)
    if (!actor) return apiError(401, 'unauthenticated', 'Sign in to continue.')

    const user = await admin.manageUser.execute(actor, {
      userId: body.userId,
      action: body.action as ManageUserAction,
      role:
        body.role === 'user' ||
        body.role === 'owner' ||
        body.role === 'agent' ||
        body.role === 'admin'
          ? (body.role as UserRole)
          : undefined,
      reason: body.reason != null ? String(body.reason) : null,
    })

    return NextResponse.json({ data: { user } })
  } catch (error) {
    const mapped = mapCommonApiError(error)
    if (mapped) return mapped

    console.error('PATCH /api/v1/admin/users failed:', error)
    return apiError(500, 'internal_error', 'Something went wrong on our side')
  }
}
