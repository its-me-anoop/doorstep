/**
 * POST /api/v1/enquiries — submit an enquiry (PRD §6.4 ENQ-1/2/3).
 * Public + optional session; guests need Turnstile.
 */

import { NextResponse, type NextRequest } from 'next/server'

import { ListingNotFoundError } from '@/ports/listing-repository'
import { apiError } from '@/lib/api-error'
import { createServices } from '@/lib/composition'
import { mapCommonApiError } from '@/lib/map-common-api-error'
import { requestRemoteIp } from '@/lib/request-remote-ip'
import { resolveSessionUser } from '@/lib/resolve-session-user'
import {
  CaptchaFailedError,
  EnquiryValidationError,
  HoneypotTriggeredError,
  ListingNotEnquirableError,
  RateLimitedError,
} from '@/services/enquiries'

export async function POST(request: NextRequest): Promise<NextResponse> {
  const rawBody: unknown = await request.json().catch(() => null)
  if (!rawBody || typeof rawBody !== 'object') {
    return apiError(400, 'invalid_request', 'Invalid request body')
  }

  const { auth, enquiries } = createServices()

  try {
    const actor = await resolveSessionUser(request, auth.getCurrentUser)
    const body = rawBody as Record<string, unknown>

    const enquiry = await enquiries.submitEnquiry.execute(actor, {
      propertyId: String(body.propertyId ?? ''),
      name: String(body.name ?? ''),
      email: String(body.email ?? ''),
      phone: body.phone != null ? String(body.phone) : null,
      message: String(body.message ?? ''),
      viewingRequested: Boolean(body.viewingRequested),
      website: body.website != null ? String(body.website) : undefined,
      captchaToken:
        body.captchaToken != null ? String(body.captchaToken) : null,
      remoteIp: requestRemoteIp(request),
    })

    return NextResponse.json({ data: { enquiry } })
  } catch (error) {
    if (error instanceof HoneypotTriggeredError) {
      return NextResponse.json({ data: { ok: true } })
    }
    if (error instanceof RateLimitedError) {
      return apiError(429, 'rate_limited', error.message)
    }
    if (error instanceof CaptchaFailedError) {
      return apiError(400, 'captcha_failed', error.message)
    }
    if (
      error instanceof ListingNotEnquirableError ||
      error instanceof ListingNotFoundError
    ) {
      return apiError(404, 'not_found', error.message)
    }
    if (error instanceof EnquiryValidationError) {
      const message = error.issues[0]?.message ?? error.message
      return apiError(400, 'validation_error', message)
    }

    const mapped = mapCommonApiError(error)
    if (mapped) return mapped

    console.error('POST /api/v1/enquiries failed:', error)
    return apiError(500, 'internal_error', 'Something went wrong on our side')
  }
}
