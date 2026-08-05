/**
 * POST /api/v1/onboarding/owner — PRD §6.5 LST-1's "I'm a private owner"
 * path: an instant, server-driven role upgrade for a signed-in `user`. No
 * request body — the actor is entirely determined by the session cookie.
 *
 * Thin per PRD §8.5: verify the session cookie, call BecomeOwner, map the
 * result to a response. Session verification mirrors the read side of
 * /api/v1/auth/session (reads the cookie straight off `request.cookies`,
 * then calls the same GetCurrentUser service that route uses) rather than
 * lib/session.ts's next/headers-based getSessionUser — that keeps this
 * route, like the session route, testable by mocking @/lib/composition
 * alone, with no next/headers mock required.
 *
 * Response: `{ data: { user } }` — the updated user (ports/user-repository's
 * User shape). This is a Flutter-contract shape (PRD §10): the phase-2 app
 * reuses this endpoint as-is.
 */

import { NextResponse, type NextRequest } from 'next/server'

import { apiError } from '@/lib/api-error'
import { createServices } from '@/lib/composition'
import { SESSION_COOKIE_NAME } from '@/lib/session-cookie-name'
import { InvalidTokenError } from '@/ports/auth-gateway'
import { AccountSuspendedError, UnknownSessionUserError } from '@/services/auth'
import { ForbiddenError } from '@/services/authz'

export async function POST(request: NextRequest): Promise<NextResponse> {
  const cookie = request.cookies.get(SESSION_COOKIE_NAME)?.value
  if (!cookie) {
    return apiError(401, 'unauthenticated', 'Sign in to continue.')
  }

  const { auth, listers } = createServices()

  try {
    const { user: actor } = await auth.getCurrentUser.execute(cookie)
    const { user } = await listers.becomeOwner.execute(actor)
    return NextResponse.json({ data: { user } })
  } catch (error) {
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
    // Anything else is infrastructure (unreachable database, misconfigured
    // service account) — see /api/v1/auth/session's route for the same
    // reasoning.
    console.error('POST /api/v1/onboarding/owner failed:', error)
    return apiError(500, 'internal_error', 'Something went wrong on our side')
  }
}
