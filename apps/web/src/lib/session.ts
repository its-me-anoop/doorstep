/**
 * lib/session.ts — the server-side session helper used by server
 * components and route handlers (getSessionUser). proxy.ts never calls
 * this — it only ever sees the raw cookie via lib/decide-gate.ts's
 * parseSessionClaims, which is deliberately cheaper and unverified; this
 * helper does the real, cryptographically-verified read via
 * services/auth's GetCurrentUser. See PRD §8.4.
 *
 * Sliding renewal and the 14-day Firebase cap: a Firebase session cookie
 * is minted once (services/auth/establish-session.ts) with a fixed
 * `exp` baked into its signed payload — there is no Admin SDK operation
 * that extends an *existing* cookie's cryptographic lifetime, and it
 * cannot be pushed past Firebase's 14-day maximum without the client
 * presenting a fresh ID token. "Sliding" here means: once
 * GetCurrentUser reports the cookie is past half its lifetime,
 * getSessionUser re-sends the *same* cookie value with a freshly
 * computed Max-Age (the time actually remaining until the cookie's real
 * expiry). That keeps a browser that would otherwise start treating the
 * cookie as "about to expire" holding onto it for its full remaining
 * life, refreshed on ordinary activity rather than on a fixed schedule —
 * but it is still bounded by the original 14-day cookie. Once that cap
 * is reached the user has to sign in again (or the client refreshes its
 * Firebase ID token in the background and re-POSTs to
 * /api/v1/auth/session, which mints a genuinely new 14-day cookie).
 */

import { cookies } from 'next/headers'

import type { User } from '@/ports/user-repository'

import { createServices } from './composition'
import { SESSION_COOKIE_NAME } from './session-cookie-name'

export { SESSION_COOKIE_NAME }

export interface SessionUser {
  user: User
}

export async function getSessionUser(): Promise<SessionUser | null> {
  const store = await cookies()
  const cookieValue = store.get(SESSION_COOKIE_NAME)?.value
  if (!cookieValue) return null

  const { auth } = createServices()

  let result: Awaited<ReturnType<typeof auth.getCurrentUser.execute>>
  try {
    result = await auth.getCurrentUser.execute(cookieValue)
  } catch {
    return null
  }

  if (result.reissue) {
    reissueCookie(store, cookieValue, result.identity.expiresAt)
  }

  return { user: result.user }
}

function reissueCookie(
  store: Awaited<ReturnType<typeof cookies>>,
  cookieValue: string,
  expiresAt: Date,
): void {
  const maxAge = Math.max(
    0,
    Math.floor((expiresAt.getTime() - Date.now()) / 1000),
  )

  try {
    store.set(SESSION_COOKIE_NAME, cookieValue, {
      httpOnly: true,
      secure: process.env.NODE_ENV !== 'development',
      sameSite: 'lax',
      path: '/',
      maxAge,
    })
  } catch {
    // getSessionUser() can be called from a Server Component render,
    // where cookies() only allows reads — .set() throws there by design
    // (Next.js: cookies can only be modified in a Server Action or Route
    // Handler). That's fine: this is a best-effort renewal signal, not a
    // correctness requirement. The next call from a Route Handler (or
    // the client's own periodic ID-token refresh) picks it up.
  }
}
