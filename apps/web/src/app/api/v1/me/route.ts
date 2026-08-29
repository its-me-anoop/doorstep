/**
 * GET /api/v1/me — current user profile.
 * PATCH — update display name and phone.
 * DELETE — GDPR account deletion (PRD §6.3 ACC-3).
 */

import { NextResponse, type NextRequest } from 'next/server'

import { apiError } from '@/lib/api-error'
import { createServices } from '@/lib/composition'
import { mapCommonApiError } from '@/lib/map-common-api-error'
import { resolveSessionUser } from '@/lib/resolve-session-user'
import { SESSION_COOKIE_NAME } from '@/lib/session-cookie-name'

export async function GET(request: NextRequest): Promise<NextResponse> {
  if (!request.cookies.get(SESSION_COOKIE_NAME)?.value) {
    return apiError(401, 'unauthenticated', 'Sign in to continue.')
  }

  const { auth, account } = createServices()

  try {
    const actor = await resolveSessionUser(request, auth.getCurrentUser)
    if (!actor) return apiError(401, 'unauthenticated', 'Sign in to continue.')

    const user = await account.getMe.execute(actor)
    return NextResponse.json({ data: { user } })
  } catch (error) {
    const mapped = mapCommonApiError(error)
    if (mapped) return mapped

    console.error('GET /api/v1/me failed:', error)
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

  const body = rawBody as { displayName?: unknown; phone?: unknown }

  const { auth, account } = createServices()

  try {
    const actor = await resolveSessionUser(request, auth.getCurrentUser)
    if (!actor) return apiError(401, 'unauthenticated', 'Sign in to continue.')

    const user = await account.updateProfile.execute(actor, {
      displayName: String(body.displayName ?? ''),
      phone: body.phone != null ? String(body.phone) : null,
    })

    return NextResponse.json({ data: { user } })
  } catch (error) {
    const mapped = mapCommonApiError(error)
    if (mapped) return mapped

    console.error('PATCH /api/v1/me failed:', error)
    return apiError(500, 'internal_error', 'Something went wrong on our side')
  }
}

export async function DELETE(request: NextRequest): Promise<NextResponse> {
  if (!request.cookies.get(SESSION_COOKIE_NAME)?.value) {
    return apiError(401, 'unauthenticated', 'Sign in to continue.')
  }

  const { auth, account } = createServices()

  try {
    const actor = await resolveSessionUser(request, auth.getCurrentUser)
    if (!actor) return apiError(401, 'unauthenticated', 'Sign in to continue.')

    await account.deleteAccount.execute(actor)

    const response = NextResponse.json({ data: { ok: true } })
    response.cookies.set(SESSION_COOKIE_NAME, '', {
      httpOnly: true,
      secure: process.env.NODE_ENV !== 'development',
      sameSite: 'lax',
      path: '/',
      maxAge: 0,
    })
    return response
  } catch (error) {
    const mapped = mapCommonApiError(error)
    if (mapped) return mapped

    console.error('DELETE /api/v1/me failed:', error)
    return apiError(500, 'internal_error', 'Something went wrong on our side')
  }
}
