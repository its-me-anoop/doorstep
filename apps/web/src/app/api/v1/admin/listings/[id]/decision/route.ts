/**
 * POST /api/v1/admin/listings/{id}/decision — approve or reject (ADM-1).
 */

import { NextResponse, type NextRequest } from 'next/server'

import { InvalidTransitionError } from '@/domain/property-status-machine'
import { apiError } from '@/lib/api-error'
import { createServices } from '@/lib/composition'
import { mapCommonApiError } from '@/lib/map-common-api-error'
import { resolveSessionUser } from '@/lib/resolve-session-user'
import { SESSION_COOKIE_NAME } from '@/lib/session-cookie-name'
import type { ListingDecision } from '@/services/admin'

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

  const body = rawBody as { decision?: unknown; rejectionReason?: unknown }
  if (body.decision !== 'approve' && body.decision !== 'reject') {
    return apiError(400, 'validation_error', 'Invalid decision.')
  }

  const { auth, admin } = createServices()

  try {
    const actor = await resolveSessionUser(request, auth.getCurrentUser)
    if (!actor) return apiError(401, 'unauthenticated', 'Sign in to continue.')

    const { id } = await params
    const listing = await admin.decideListing.execute(actor, {
      listingId: id,
      decision: body.decision as ListingDecision,
      rejectionReason:
        body.rejectionReason != null
          ? String(body.rejectionReason)
          : null,
    })

    return NextResponse.json({ data: { listing } })
  } catch (error) {
    if (error instanceof InvalidTransitionError) {
      return apiError(409, 'invalid_transition', error.message)
    }

    const mapped = mapCommonApiError(error)
    if (mapped) return mapped

    console.error(
      'POST /api/v1/admin/listings/[id]/decision failed:',
      error,
    )
    return apiError(500, 'internal_error', 'Something went wrong on our side')
  }
}
