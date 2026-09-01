/**
 * POST /api/v1/admin/reports/{id}/resolve — close a report (ADM-2).
 */

import { NextResponse, type NextRequest } from 'next/server'

import { apiError } from '@/lib/api-error'
import { createServices } from '@/lib/composition'
import { mapCommonApiError } from '@/lib/map-common-api-error'
import { resolveSessionUser } from '@/lib/resolve-session-user'
import { SESSION_COOKIE_NAME } from '@/lib/session-cookie-name'
import type { ReportResolution } from '@/services/admin'

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
  if (!rawBody || typeof rawBody !== 'object') {
    return apiError(400, 'invalid_request', 'Invalid request body')
  }

  const body = rawBody as { status?: unknown; reason?: unknown }
  if (body.status !== 'resolved' && body.status !== 'dismissed') {
    return apiError(400, 'validation_error', 'Invalid resolution status.')
  }

  const { auth, admin } = createServices()

  try {
    const actor = await resolveSessionUser(request, auth.getCurrentUser)
    if (!actor) return apiError(401, 'unauthenticated', 'Sign in to continue.')

    const { id } = await params
    const report = await admin.resolveReport.execute(
      actor,
      id,
      body.status as ReportResolution,
      body.reason != null ? String(body.reason) : null,
    )

    return NextResponse.json({ data: { report } })
  } catch (error) {
    const mapped = mapCommonApiError(error)
    if (mapped) return mapped

    console.error('POST /api/v1/admin/reports/[id]/resolve failed:', error)
    return apiError(500, 'internal_error', 'Something went wrong on our side')
  }
}
