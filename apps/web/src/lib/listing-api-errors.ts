/**
 * mapCommonListingError — the error-to-envelope mapping shared by every
 * src/app/api/v1/listings/* route handler (PRD §8.5's thin-handler
 * pattern: "map result" is this). Covers the failures common to all six
 * routes (session/authz/not-found); each route's own catch block still
 * maps whatever service-specific errors only it can throw (e.g.
 * InvalidTransitionError only from the status-change route) after
 * calling this and finding it returned null. Mirrors the shared-mapper
 * reasoning of lib/resolve-session-user.ts — extracted once six routes
 * needed the identical block, without touching the pre-existing
 * /api/v1/onboarding/* routes that still inline their own copy.
 */

import { NextResponse } from 'next/server'

import { apiError, type ApiErrorBody } from './api-error'
import { InvalidTokenError } from '@/ports/auth-gateway'
import { ListingNotFoundError } from '@/ports/listing-repository'
import { AccountSuspendedError, UnknownSessionUserError } from '@/services/auth'
import { ForbiddenError } from '@/services/authz'

export function mapCommonListingError(
  error: unknown,
): NextResponse<ApiErrorBody> | null {
  if (error instanceof ForbiddenError) {
    return apiError(403, 'forbidden', error.message)
  }
  if (error instanceof AccountSuspendedError) {
    return apiError(403, 'account_suspended', error.message)
  }
  if (
    error instanceof InvalidTokenError ||
    error instanceof UnknownSessionUserError
  ) {
    return apiError(401, 'unauthenticated', 'Sign in to continue.')
  }
  if (error instanceof ListingNotFoundError) {
    return apiError(404, 'not_found', error.message)
  }
  return null
}
