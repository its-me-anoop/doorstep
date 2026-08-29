/**
 * GET /api/v1/admin/reports — open user reports (ADM-2).
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

  const { auth, admin } = createServices()

  try {
    const actor = await resolveSessionUser(request, auth.getCurrentUser)
    if (!actor) return apiError(401, 'unauthenticated', 'Sign in to continue.')

    const cursor = request.nextUrl.searchParams.get('cursor')
    const limitRaw = request.nextUrl.searchParams.get('limit')
    const limit = limitRaw ? Number.parseInt(limitRaw, 10) : undefined

    const page = await admin.listOpenReports.execute(actor, {
      cursor,
      limit: Number.isFinite(limit) ? limit : undefined,
    })

    return NextResponse.json({ data: page.data, nextCursor: page.nextCursor })
  } catch (error) {
    const mapped = mapCommonApiError(error)
    if (mapped) return mapped

    console.error('GET /api/v1/admin/reports failed:', error)
    return apiError(500, 'internal_error', 'Something went wrong on our side')
  }
}
