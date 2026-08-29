/**
 * POST /api/v1/events — record first-party analytics event.
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
    name?: unknown
    anonId?: unknown
    properties?: unknown
  }

  if (typeof body.name !== 'string' || !body.name.trim()) {
    return apiError(400, 'validation_error', 'Event name is required.')
  }

  if (typeof body.anonId !== 'string' || !body.anonId.trim()) {
    return apiError(400, 'validation_error', 'anonId is required.')
  }

  const { auth, analytics } = createServices()

  try {
    const actor = await resolveSessionUser(request, auth.getCurrentUser)

    const event = await analytics.recordEvent.execute({
      name: body.name.trim(),
      anonId: body.anonId.trim(),
      userId: actor?.id ?? null,
      properties:
        body.properties && typeof body.properties === 'object'
          ? (body.properties as Record<string, unknown>)
          : undefined,
    })

    return NextResponse.json({ data: { event } })
  } catch (error) {
    const mapped = mapCommonApiError(error)
    if (mapped) return mapped

    console.error('POST /api/v1/events failed:', error)
    return apiError(500, 'internal_error', 'Something went wrong on our side')
  }
}
