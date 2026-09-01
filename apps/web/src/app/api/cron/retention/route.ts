/**
 * GET /api/cron/retention — GDPR enquiry anonymisation (PRD §7.5).
 */

import { NextResponse, type NextRequest } from 'next/server'

import { apiError } from '@/lib/api-error'
import { createServices } from '@/lib/composition'
import { isAuthorizedCronRequest } from '@/lib/verify-cron-request'

export async function GET(request: NextRequest): Promise<NextResponse> {
  if (!isAuthorizedCronRequest(request.headers)) {
    return apiError(
      401,
      'unauthorized',
      'This endpoint requires a valid cron secret.',
    )
  }

  const { retention } = createServices()

  try {
    const count = await retention.anonymiseEnquiries.execute()
    return NextResponse.json({ data: { anonymised: count } })
  } catch (error) {
    console.error('GET /api/cron/retention failed:', error)
    return apiError(500, 'internal_error', 'Something went wrong on our side')
  }
}
