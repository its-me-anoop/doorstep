/**
 * resolveSessionUser — the session-cookie resolution step shared by every
 * src/app/api/v1/listings/* route handler (PRD §8.5's thin-handler
 * pattern: parse, call service, map result — this is the "parse the
 * session" half of that, common to six routes). Mirrors, rather than
 * replaces, the pattern src/app/api/v1/onboarding/{owner,agency}/route.ts
 * each still inline: reads `request.cookies` directly instead of
 * lib/session.ts's next/headers-based getSessionUser, so every caller
 * stays testable by mocking a plain `{ execute }`-shaped GetCurrentUser,
 * no next/headers mock required. Those two onboarding routes are left as
 * they are — extracting this only for the six new listings routes avoids
 * an unrelated drive-by refactor of files this change doesn't otherwise
 * touch.
 *
 * Returns null when there is no session cookie at all; the caller maps
 * that itself to 401 unauthenticated. An invalid/expired cookie is a
 * different path — `getCurrentUser.execute` rejects with
 * InvalidTokenError/UnknownSessionUserError, which the caller's own
 * try/catch (already needed for service-specific errors) still handles.
 */

import type { NextRequest } from 'next/server'

import type { GetCurrentUser } from '@/services/auth'

import { SESSION_COOKIE_NAME } from './session-cookie-name'

export async function resolveSessionUser(
  request: NextRequest,
  getCurrentUser: Pick<GetCurrentUser, 'execute'>,
) {
  const cookie = request.cookies.get(SESSION_COOKIE_NAME)?.value
  if (!cookie) return null

  const { user } = await getCurrentUser.execute(cookie)
  return user
}
