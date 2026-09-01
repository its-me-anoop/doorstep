/**
 * GET /api/v1/listings/{id}/enquiries — lister inbox filtered to one
 * listing (PRD §6.4 ENQ-4). Session required.
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

export async function GET(
  request: NextRequest,
  { params }: RouteContext,
): Promise<NextResponse> {
  if (!request.cookies.get(SESSION_COOKIE_NAME)?.value) {
    return apiError(401, 'unauthenticated', 'Sign in to continue.')
  }

  const { auth, enquiries, listings } = createServices()

  try {
    const actor = await resolveSessionUser(request, auth.getCurrentUser)
    if (!actor) return apiError(401, 'unauthenticated', 'Sign in to continue.')

    const { id } = await params
    await listings.getListing.execute(actor, id)

    const statusParam = request.nextUrl.searchParams.get('status')
    const status =
      statusParam === 'new' ||
      statusParam === 'contacted' ||
      statusParam === 'closed'
        ? (statusParam as EnquiryStatus)
        : undefined

    const cursor = request.nextUrl.searchParams.get('cursor')
    const limitRaw = request.nextUrl.searchParams.get('limit')
    const limit = limitRaw ? Number.parseInt(limitRaw, 10) : undefined

    const page = await enquiries.listListerEnquiries.execute(actor, {
      status,
      cursor,
      limit: Number.isFinite(limit) ? limit : undefined,
    })

    const filtered = page.data.filter((enquiry) => enquiry.propertyId === id)

    return NextResponse.json({
      data: filtered,
      nextCursor: page.nextCursor,
    })
  } catch (error) {
    const mapped = mapCommonApiError(error)
    if (mapped) return mapped

    console.error('GET /api/v1/listings/[id]/enquiries failed:', error)
    return apiError(500, 'internal_error', 'Something went wrong on our side')
  }
}
