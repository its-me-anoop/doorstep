/**
 * GET/PATCH/DELETE /api/v1/listings/{id} — PRD §10: "Edit draft or
 * published listing", plus the M1-DESIGN-SPEC.md §4.3/§4.4 "Delete draft"
 * dashboard action (DELETE — see services/listings/delete-listing.ts's
 * doc comment for why this is an M1 contract addition beyond the PRD's
 * original API surface, not a PRD-documented endpoint). Object-level:
 * manager only in M1 (services/listings/get-listing.ts, update-listing.ts,
 * delete-listing.ts's shared canManageListing) — the *public* detail page
 * is reached by slug (GET /api/v1/properties/{slug}) and is M2+, not this
 * route.
 *
 * Thin per PRD §8.5: resolve the session, parse the PATCH body against
 * lib/validation/listing.ts's draftListingSchema (the same schema POST
 * /api/v1/listings uses — see that route's doc comment), call a service,
 * map the result. DELETE has no body — like POST .../submit, the target
 * listing is entirely identified by the path segment — and returns
 * `{ data: { deleted: true } }` rather than the listing itself, since
 * there is nothing left to return.
 *
 * PATCH revalidates the listing's detail page (and any matching area
 * page) on success, but only when the *updated* listing is publicly
 * visible (published/under_offer — the same pair
 * services/listings/update-listing.ts's own VISIBLE_STATUSES names,
 * duplicated locally per this codebase's established convention for that
 * pair — see e.g. change-listing-status.ts's isVisible): a draft,
 * rejected or pending_review edit has no public page to revalidate. GET
 * and DELETE never change visibility, so neither revalidates anything
 * (see lib/listing-revalidation.ts).
 */

import { NextResponse, type NextRequest } from 'next/server'

import type { PropertyStatus } from '@/domain/enums'
import { apiError } from '@/lib/api-error'
import { createServices } from '@/lib/composition'
import { mapCommonListingError } from '@/lib/listing-api-errors'
import { revalidateListingPaths } from '@/lib/listing-revalidation'
import { resolveSessionUser } from '@/lib/resolve-session-user'
import { SESSION_COOKIE_NAME } from '@/lib/session-cookie-name'
import { draftListingSchema } from '@/lib/validation/listing'
import {
  ListingChannelImmutableError,
  ListingNotDeletableError,
  ListingNotEditableError,
} from '@/services/listings'

const VISIBLE_STATUSES: ReadonlySet<PropertyStatus> = new Set([
  'published',
  'under_offer',
])

interface RouteContext {
  params: Promise<{ id: string }>
}

export async function GET(
  request: NextRequest,
  { params }: RouteContext,
): Promise<NextResponse> {
  const { auth, listings } = createServices()

  try {
    const actor = await resolveSessionUser(request, auth.getCurrentUser)
    if (!actor) return apiError(401, 'unauthenticated', 'Sign in to continue.')

    const { id } = await params
    const listing = await listings.getListing.execute(actor, id)
    return NextResponse.json({ data: { listing } })
  } catch (error) {
    const mapped = mapCommonListingError(error)
    if (mapped) return mapped
    console.error('GET /api/v1/listings/[id] failed:', error)
    return apiError(500, 'internal_error', 'Something went wrong on our side')
  }
}

export async function PATCH(
  request: NextRequest,
  { params }: RouteContext,
): Promise<NextResponse> {
  if (!request.cookies.get(SESSION_COOKIE_NAME)?.value) {
    return apiError(401, 'unauthenticated', 'Sign in to continue.')
  }

  const rawBody: unknown = await request.json().catch(() => null)
  const parsed = draftListingSchema.safeParse(rawBody)
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
    const listing = await listings.updateListing.execute(actor, id, parsed.data)
    if (VISIBLE_STATUSES.has(listing.status)) {
      revalidateListingPaths(listing)
    }
    return NextResponse.json({ data: { listing } })
  } catch (error) {
    if (error instanceof ListingNotEditableError) {
      return apiError(409, 'listing_not_editable', error.message)
    }
    if (error instanceof ListingChannelImmutableError) {
      return apiError(400, 'invalid_request', error.message)
    }
    const mapped = mapCommonListingError(error)
    if (mapped) return mapped
    console.error('PATCH /api/v1/listings/[id] failed:', error)
    return apiError(500, 'internal_error', 'Something went wrong on our side')
  }
}

export async function DELETE(
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
    await listings.deleteListing.execute(actor, id)
    return NextResponse.json({ data: { deleted: true } })
  } catch (error) {
    if (error instanceof ListingNotDeletableError) {
      return apiError(409, 'listing_not_deletable', error.message)
    }
    const mapped = mapCommonListingError(error)
    if (mapped) return mapped
    console.error('DELETE /api/v1/listings/[id] failed:', error)
    return apiError(500, 'internal_error', 'Something went wrong on our side')
  }
}
