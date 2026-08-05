/**
 * POST /api/v1/onboarding/agency — PRD §6.5 LST-1's "I'm an agent" ->
 * create-a-new-agency path. Joining an *existing* agency (the PRD's
 * "requests to join, approved by the agency creator" flow) is explicitly
 * out of scope for M1 and is not implemented by this route.
 *
 * Thin per PRD §8.5: parse and validate the body with the shared zod
 * schema, verify the session cookie, call CreateAgency, map the result to
 * a response. Session verification mirrors POST /api/v1/onboarding/owner
 * — see that route's doc comment for why it reads `request.cookies`
 * directly rather than lib/session.ts's getSessionUser.
 *
 * Response: `{ data: { user, agency } }` — both in their port shapes
 * (ports/user-repository's User, ports/agency-repository's Agency). This
 * is a Flutter-contract shape (PRD §10): the phase-2 app reuses this
 * endpoint as-is.
 */

import { NextResponse, type NextRequest } from 'next/server'

import { apiError } from '@/lib/api-error'
import { createServices } from '@/lib/composition'
import { SESSION_COOKIE_NAME } from '@/lib/session-cookie-name'
import { createAgencySchema } from '@/lib/validation/agency'
import { InvalidTokenError } from '@/ports/auth-gateway'
import { AccountSuspendedError, UnknownSessionUserError } from '@/services/auth'
import { ForbiddenError } from '@/services/authz'

export async function POST(request: NextRequest): Promise<NextResponse> {
  const cookie = request.cookies.get(SESSION_COOKIE_NAME)?.value
  if (!cookie) {
    return apiError(401, 'unauthenticated', 'Sign in to continue.')
  }

  const rawBody: unknown = await request.json().catch(() => null)
  const parsed = createAgencySchema.safeParse(rawBody)
  if (!parsed.success) {
    return apiError(
      400,
      'invalid_request',
      parsed.error.issues[0]?.message ?? 'Invalid request body',
    )
  }

  const { auth, listers } = createServices()

  try {
    const { user: actor } = await auth.getCurrentUser.execute(cookie)
    const { user, agency } = await listers.createAgency.execute(
      actor,
      parsed.data,
    )
    return NextResponse.json({ data: { user, agency } })
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
    // Anything else — including the vanishingly unlikely case of
    // CreateAgency's own single retry also losing a slug race — is
    // treated as infrastructure the caller should simply retry, same
    // reasoning as /api/v1/auth/session's route.
    console.error('POST /api/v1/onboarding/agency failed:', error)
    return apiError(500, 'internal_error', 'Something went wrong on our side')
  }
}
