/**
 * PATCH /api/v1/enquiries/{id} — update enquiry status (PRD §6.4 ENQ-4).
 */

import { NextResponse, type NextRequest } from 'next/server'

import { apiError } from '@/lib/api-error'
import { createServices } from '@/lib/composition'
import { mapCommonApiError } from '@/lib/map-common-api-error'
import { resolveSessionUser } from '@/lib/resolve-session-user'
import { SESSION_COOKIE_NAME } from '@/lib/session-cookie-name'
import type { EnquiryStatus } from '@/domain/enums'

interface RouteContext {
  params: Promise<{ id: string }>
}

const VALID_STATUSES: ReadonlySet<EnquiryStatus> = new Set([
  'new',
  'contacted',
  'closed',
])

export async function PATCH(
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

  const status = (rawBody as { status?: unknown }).status
  if (typeof status !== 'string' || !VALID_STATUSES.has(status as EnquiryStatus)) {
    return apiError(400, 'validation_error', 'Invalid status.')
  }

  const { auth, enquiries } = createServices()

  try {
    const actor = await resolveSessionUser(request, auth.getCurrentUser)
    if (!actor) return apiError(401, 'unauthenticated', 'Sign in to continue.')

    const { id } = await params
    const enquiry = await enquiries.updateEnquiryStatus.execute(
      actor,
      id,
      status as EnquiryStatus,
    )

    return NextResponse.json({ data: { enquiry } })
  } catch (error) {
    const mapped = mapCommonApiError(error)
    if (mapped) return mapped

    console.error('PATCH /api/v1/enquiries/[id] failed:', error)
    return apiError(500, 'internal_error', 'Something went wrong on our side')
  }
}
