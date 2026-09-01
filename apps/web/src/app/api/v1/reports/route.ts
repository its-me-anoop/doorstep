/**
 * POST /api/v1/reports — public listing report (PRD §6.6 ADM-2).
 */

import { NextResponse, type NextRequest } from 'next/server'

import { apiError } from '@/lib/api-error'
import { createServices } from '@/lib/composition'
import { mapCommonApiError } from '@/lib/map-common-api-error'
import { resolveSessionUser } from '@/lib/resolve-session-user'

export async function POST(request: NextRequest): Promise<NextResponse> {
  const rawBody: unknown = await request.json().catch(() => null)
  if (!rawBody || typeof rawBody !== 'object') {
    return apiError(400, 'invalid_request', 'Invalid request body')
  }

  const body = rawBody as {
    propertyId?: unknown
    reason?: unknown
    details?: unknown
    reporterEmail?: unknown
  }

  const { auth, admin } = createServices()

  try {
    const actor = await resolveSessionUser(request, auth.getCurrentUser)

    const report = await admin.submitReport.execute(actor, {
      propertyId: String(body.propertyId ?? ''),
      reason: String(body.reason ?? ''),
      details: body.details != null ? String(body.details) : null,
      reporterEmail:
        body.reporterEmail != null ? String(body.reporterEmail) : null,
    })

    return NextResponse.json({ data: { report } })
  } catch (error) {
    const mapped = mapCommonApiError(error)
    if (mapped) return mapped

    console.error('POST /api/v1/reports failed:', error)
    return apiError(500, 'internal_error', 'Something went wrong on our side')
  }
}
