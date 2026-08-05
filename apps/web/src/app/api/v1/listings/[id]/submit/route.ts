/**
 * POST /api/v1/listings/{id}/submit — PRD §10: "Draft or rejected to
 * pending_review" (PRD §6.5 LST-2's review-and-submit step). No request
 * body: the listing being submitted is entirely identified by the path
 * segment, and its content comes from whatever the wizard already saved
 * via PATCH /api/v1/listings/{id}.
 *
 * Thin per PRD §8.5: resolve the session, call SubmitListing, map the
 * result. Two error mappings are specific to this route (on top of
 * mapCommonListingError's session/authz/not-found cases):
 *  - InvalidTransitionError (domain/property-status-machine.ts) — the
 *    listing's current status isn't draft or rejected. 409, since the
 *    resource exists but is in a state that conflicts with the request.
 *  - ListingIncompleteError (services/listings/errors.ts) — status was
 *    submittable but a required field (PRD §9.2, channel-conditional) is
 *    missing. 400, with the first zod issue's own message surfaced as
 *    this error's message (same "first issue wins" convention every
 *    validation-failure branch in this API already uses for a
 *    parsed.error.issues[0]?.message).
 */

import { NextResponse, type NextRequest } from 'next/server'

import { InvalidTransitionError } from '@/domain/property-status-machine'
import { apiError } from '@/lib/api-error'
import { createServices } from '@/lib/composition'
import { mapCommonListingError } from '@/lib/listing-api-errors'
import { resolveSessionUser } from '@/lib/resolve-session-user'
import { SESSION_COOKIE_NAME } from '@/lib/session-cookie-name'
import { ListingIncompleteError } from '@/services/listings'

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

  const { auth, listings } = createServices()

  try {
    const actor = await resolveSessionUser(request, auth.getCurrentUser)
    if (!actor) return apiError(401, 'unauthenticated', 'Sign in to continue.')

    const { id } = await params
    const listing = await listings.submitListing.execute(actor, id)
    return NextResponse.json({ data: { listing } })
  } catch (error) {
    if (error instanceof InvalidTransitionError) {
      return apiError(409, 'invalid_transition', error.message)
    }
    if (error instanceof ListingIncompleteError) {
      const message = error.issues[0]?.message ?? error.message
      return apiError(400, 'listing_incomplete', message)
    }
    const mapped = mapCommonListingError(error)
    if (mapped) return mapped
    console.error('POST /api/v1/listings/[id]/submit failed:', error)
    return apiError(500, 'internal_error', 'Something went wrong on our side')
  }
}
