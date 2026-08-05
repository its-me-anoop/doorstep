/**
 * GET/POST /api/v1/listings — PRD §10: "My or my agency's listings; create
 * draft" (PRD §6.5 LST-2 step 1). Session required for both; the create
 * side is owner/agent only (services/listings/create-listing-draft.ts's
 * requireRole).
 *
 * Thin per PRD §8.5: resolve the session (lib/resolve-session-user.ts),
 * parse with zod (GET's cursor/limit query params; POST's body against
 * lib/validation/listing.ts's draftListingSchema — shared with PATCH
 * /api/v1/listings/{id}, see that schema's doc comment), call a service,
 * map the result. GET returns `{ data, nextCursor }` — `data` is the
 * listing array itself, not wrapped in an object, matching PRD §10's
 * cursor-pagination convention; POST returns the created draft as
 * `{ data: { listing } }`, matching every other single-resource route in
 * this API.
 */

import { NextResponse, type NextRequest } from 'next/server'
import { z } from 'zod'

import { apiError } from '@/lib/api-error'
import { createServices } from '@/lib/composition'
import { mapCommonListingError } from '@/lib/listing-api-errors'
import { resolveSessionUser } from '@/lib/resolve-session-user'
import { SESSION_COOKIE_NAME } from '@/lib/session-cookie-name'
import { draftListingSchema } from '@/lib/validation/listing'

const listQuerySchema = z.object({
  cursor: z.string().min(1).nullish(),
  limit: z.coerce.number().int().min(1).max(100).optional(),
})

export async function GET(request: NextRequest): Promise<NextResponse> {
  const { auth, listings } = createServices()

  try {
    const actor = await resolveSessionUser(request, auth.getCurrentUser)
    if (!actor) return apiError(401, 'unauthenticated', 'Sign in to continue.')

    const query = listQuerySchema.parse({
      cursor: request.nextUrl.searchParams.get('cursor'),
      limit: request.nextUrl.searchParams.get('limit') ?? undefined,
    })

    const page = await listings.listMyListings.execute(actor, {
      cursor: query.cursor,
      limit: query.limit,
    })
    return NextResponse.json({ data: page.data, nextCursor: page.nextCursor })
  } catch (error) {
    const mapped = mapCommonListingError(error)
    if (mapped) return mapped
    console.error('GET /api/v1/listings failed:', error)
    return apiError(500, 'internal_error', 'Something went wrong on our side')
  }
}

export async function POST(request: NextRequest): Promise<NextResponse> {
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

    const listing = await listings.createListingDraft.execute(
      actor,
      parsed.data,
    )
    return NextResponse.json({ data: { listing } }, { status: 201 })
  } catch (error) {
    const mapped = mapCommonListingError(error)
    if (mapped) return mapped
    console.error('POST /api/v1/listings failed:', error)
    return apiError(500, 'internal_error', 'Something went wrong on our side')
  }
}
