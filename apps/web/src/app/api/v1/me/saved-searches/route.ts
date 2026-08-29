/**
 * GET /api/v1/me/saved-searches — list saved filter sets.
 * POST — save a new search (PRD §6.1 SRCH-6 / §6.3).
 */

import { NextResponse, type NextRequest } from 'next/server'

import type { Channel } from '@/domain/enums'
import type { SavedSearchCriteria } from '@/domain/saved'
import { apiError } from '@/lib/api-error'
import { createServices } from '@/lib/composition'
import { mapCommonApiError } from '@/lib/map-common-api-error'
import { resolveSessionUser } from '@/lib/resolve-session-user'
import { SESSION_COOKIE_NAME } from '@/lib/session-cookie-name'

export async function GET(request: NextRequest): Promise<NextResponse> {
  if (!request.cookies.get(SESSION_COOKIE_NAME)?.value) {
    return apiError(401, 'unauthenticated', 'Sign in to continue.')
  }

  const { auth, saved } = createServices()

  try {
    const actor = await resolveSessionUser(request, auth.getCurrentUser)
    if (!actor) return apiError(401, 'unauthenticated', 'Sign in to continue.')

    const searches = await saved.listSavedSearches.execute(actor)
    return NextResponse.json({ data: searches })
  } catch (error) {
    const mapped = mapCommonApiError(error)
    if (mapped) return mapped

    console.error('GET /api/v1/me/saved-searches failed:', error)
    return apiError(500, 'internal_error', 'Something went wrong on our side')
  }
}

export async function POST(request: NextRequest): Promise<NextResponse> {
  if (!request.cookies.get(SESSION_COOKIE_NAME)?.value) {
    return apiError(401, 'unauthenticated', 'Sign in to continue.')
  }

  const rawBody: unknown = await request.json().catch(() => null)
  if (!rawBody || typeof rawBody !== 'object') {
    return apiError(400, 'invalid_request', 'Invalid request body')
  }

  const body = rawBody as {
    name?: unknown
    criteria?: unknown
  }

  if (typeof body.name !== 'string' || !body.name.trim()) {
    return apiError(400, 'validation_error', 'Enter a name for this search.')
  }

  if (!body.criteria || typeof body.criteria !== 'object') {
    return apiError(400, 'validation_error', 'Invalid search criteria.')
  }

  const criteria = body.criteria as Record<string, unknown>
  if (criteria.channel !== 'sale' && criteria.channel !== 'rent') {
    return apiError(400, 'validation_error', 'Invalid channel.')
  }

  const parsedCriteria: SavedSearchCriteria = {
    channel: criteria.channel as Channel,
    locationLabel: String(criteria.locationLabel ?? ''),
    location:
      criteria.location &&
      typeof criteria.location === 'object' &&
      'lat' in criteria.location &&
      'lng' in criteria.location
        ? {
            lat: Number((criteria.location as { lat: unknown }).lat),
            lng: Number((criteria.location as { lng: unknown }).lng),
          }
        : null,
    radiusMetres:
      criteria.radiusMetres != null
        ? Number(criteria.radiusMetres)
        : null,
    filters:
      criteria.filters && typeof criteria.filters === 'object'
        ? (criteria.filters as Record<string, unknown>)
        : {},
  }

  const { auth, saved } = createServices()

  try {
    const actor = await resolveSessionUser(request, auth.getCurrentUser)
    if (!actor) return apiError(401, 'unauthenticated', 'Sign in to continue.')

    const search = await saved.saveSearch.execute(
      actor,
      body.name,
      parsedCriteria,
    )
    return NextResponse.json({ data: { search } })
  } catch (error) {
    const mapped = mapCommonApiError(error)
    if (mapped) return mapped

    console.error('POST /api/v1/me/saved-searches failed:', error)
    return apiError(500, 'internal_error', 'Something went wrong on our side')
  }
}
