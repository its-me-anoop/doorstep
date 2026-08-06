/**
 * POST /api/v1/listings/{id}/status — PRD §10: "under_offer, completed,
 * hidden, published (back on market)" (PRD §6.5 LST-5's one-click
 * transitions). Body is `{ action }`, validated against
 * lib/validation/listing.ts's changeListingStatusSchema — the action enum
 * is deliberately narrower than the full PRD §9.3 state machine (see
 * services/listings/change-listing-status.ts's doc comment); the
 * admin-only approval edges are not reachable through this route at all.
 *
 * Thin per PRD §8.5: resolve the session, parse the body, call
 * ChangeListingStatus, map the result. Two error mappings are specific to
 * this route (on top of mapCommonListingError's session/authz/not-found
 * cases), same reasoning as POST /api/v1/listings/{id}/submit:
 *  - InvalidTransitionError — structurally impossible from the listing's
 *    current status (e.g. draft -> hidden). 409.
 *  - ListingActionChannelMismatchError — sold_stc on a rent listing, or
 *    let_agreed on a sale listing. 400 invalid_request, same code PATCH
 *    /api/v1/listings/{id} uses for ListingChannelImmutableError — both
 *    are "this request doesn't fit this listing's channel".
 *
 * Every reachable transition here changes public visibility one way or
 * the other (change-listing-status.ts's own doc comment), so a
 * successful call always revalidates the listing's detail page and any
 * matching area landing page (PRD §8.3's on-demand ISR requirement) —
 * see lib/listing-revalidation.ts.
 */

import { NextResponse, type NextRequest } from 'next/server'

import { InvalidTransitionError } from '@/domain/property-status-machine'
import { apiError } from '@/lib/api-error'
import { createServices } from '@/lib/composition'
import { mapCommonListingError } from '@/lib/listing-api-errors'
import { revalidateListingPaths } from '@/lib/listing-revalidation'
import { resolveSessionUser } from '@/lib/resolve-session-user'
import { SESSION_COOKIE_NAME } from '@/lib/session-cookie-name'
import { changeListingStatusSchema } from '@/lib/validation/listing'
import { ListingActionChannelMismatchError } from '@/services/listings'

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
  const parsed = changeListingStatusSchema.safeParse(rawBody)
  if (!parsed.success) {
    return apiError(
      400,
      'invalid_request',
      parsed.error.issues[0]?.message ?? 'Invalid request body',
    )
  }

  const { auth, listings } = createServices()

  try {
    const actor = await resolveSessionUser(request, auth.getCurrentUser)
    if (!actor) return apiError(401, 'unauthenticated', 'Sign in to continue.')

    const { id } = await params
    const listing = await listings.changeListingStatus.execute(
      actor,
      id,
      parsed.data.action,
    )
    revalidateListingPaths(listing)
    return NextResponse.json({ data: { listing } })
  } catch (error) {
    if (error instanceof InvalidTransitionError) {
      return apiError(409, 'invalid_transition', error.message)
    }
    if (error instanceof ListingActionChannelMismatchError) {
      return apiError(400, 'invalid_request', error.message)
    }
    const mapped = mapCommonListingError(error)
    if (mapped) return mapped
    console.error('POST /api/v1/listings/[id]/status failed:', error)
    return apiError(500, 'internal_error', 'Something went wrong on our side')
  }
}
