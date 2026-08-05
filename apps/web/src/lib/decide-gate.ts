/**
 * decideGate — the pure route-gating decision used by proxy.ts (Next.js
 * 16's rename of the middleware convention — see proxy.ts's doc comment).
 *
 * BIG NOTE, per PRD §8.4 ("Middleware decodes, services verify"): this is
 * UX gating only, not security. parseSessionClaims below reads the role
 * claim out of the session cookie's JWT payload WITHOUT verifying its
 * cryptographic signature. That's deliberate, not a shortcut forced by
 * the old edge runtime (Next 16's proxy runs on Node.js, so it technically
 * *could* call the Admin SDK) — proxy runs on every matched navigation,
 * including prefetches, and a network round-trip to Firebase on each one
 * would be wasteful and slow. A forged or stale claim here can, at worst,
 * let someone see a page shell for a moment before a real request fails.
 * Real authorisation happens in services/: every service re-verifies the
 * session cookie via AuthGateway.verifySessionCookie and checks
 * authorisation via services/authz/policies.ts before touching data.
 * Route handlers — and this function's caller — never decide
 * authorisation themselves.
 *
 * TWO-TIER GATING FOR /lister and /onboarding (PRD §8.4): this proxy tier
 * only checks that a *live session exists* for both prefixes — it
 * deliberately does NOT also require role owner|agent|admin for /lister,
 * even though only those roles may actually use it. The real role check
 * lives one tier in, at the (lister) route-group layout (a server
 * component that calls lib/session.ts's getSessionUser(), which is
 * cryptographically verified and DB-backed, never the cookie's claim).
 *
 * Why split it this way: a `role: user` claim baked into the session
 * cookie goes stale the instant that user completes onboarding server-
 * side (services/listers/become-owner.ts, create-agency.ts) — the
 * cookie itself isn't reissued with the new claim until the client
 * completes lib/firebase-client.ts's refreshSessionAfterUpgrade "claim
 * refresh dance", and that dance *requires a live Firebase Auth user*.
 * Per firebase-client.ts's own doc comment, the client SDK is signed out
 * immediately after every sign-in, so a live Firebase user is only ever
 * available in the same tab, right after the onboarding call that
 * granted the new role — never on a later navigation, and never after a
 * refresh. If this proxy tier still role-gated /lister on the stale
 * claim, a freshly-upgraded owner clicking straight through to /lister
 * would bounce back to /sign-in for no real reason, on every single
 * upgrade. Dropping the role check here removes that false lockout
 * entirely, at the cost of this tier alone being unable to stop a
 * `role: user` cookie from momentarily reaching the /lister route
 * segment — which is fine, because the (lister) layout's DB-backed check
 * catches it immediately after and redirects to /onboarding, and no
 * service ever trusts this tier's decision for authorisation anyway.
 * /onboarding gets the identical treatment (session-only here) for the
 * same reason in reverse: it's the *destination* a stale-claim /lister
 * visit gets redirected to, so it has to be reachable by any freshly
 * authenticated session regardless of the role the stale cookie claims.
 *
 * /admin keeps the stricter claims-gate at this tier. There is no
 * equivalent race for it — an admin claim is granted out-of-band by an
 * operator, never as the immediate next step after the user's own
 * in-session action, so there is no "just upgraded, claim is stale"
 * window to protect against here.
 */

import { USER_ROLES, type UserRole } from '@/domain/enums'

export interface GateClaims {
  role: UserRole
  /** Seconds since epoch — the session cookie's `exp` claim. */
  exp: number
}

export type GateDecision =
  | { readonly allow: true }
  | { readonly allow: false; readonly redirectTo: string }

interface RouteRule {
  prefix: string
  /** Omitted means "any authenticated session, any role". */
  roles?: readonly UserRole[]
}

const ROUTE_RULES: readonly RouteRule[] = [
  { prefix: '/admin', roles: ['admin'] },
  // No `roles` on /lister or /onboarding — session presence only. See
  // this file's top doc comment ("TWO-TIER GATING") for why the real
  // owner|agent|admin check for /lister moved to the (lister) layout.
  { prefix: '/lister' },
  { prefix: '/onboarding' },
  { prefix: '/account' },
]

export function decideGate(
  pathname: string,
  claims: GateClaims | null,
  nowSeconds: number,
): GateDecision {
  const rule = ROUTE_RULES.find((candidate) =>
    matchesPrefix(pathname, candidate.prefix),
  )
  if (!rule) return { allow: true }

  const authenticated = claims !== null && claims.exp > nowSeconds
  if (!authenticated) return denied(pathname)

  if (rule.roles && !rule.roles.includes(claims.role)) return denied(pathname)

  return { allow: true }
}

function matchesPrefix(pathname: string, prefix: string): boolean {
  return pathname === prefix || pathname.startsWith(`${prefix}/`)
}

function denied(pathname: string): GateDecision {
  return {
    allow: false,
    redirectTo: `/sign-in?next=${encodeURIComponent(pathname)}`,
  }
}

/**
 * Decodes (never verifies) a JWT's payload segment, pulling out just the
 * `exp` and `role` fields decideGate needs. Returns null for anything
 * that isn't a well-formed three-segment JWT with a numeric `exp` — an
 * absent/garbled cookie is treated the same as "no session" by the
 * caller, which is the safe direction for gating to fail in.
 */
export function parseSessionClaims(
  cookieValue: string | undefined,
): GateClaims | null {
  if (!cookieValue) return null

  const parts = cookieValue.split('.')
  if (parts.length !== 3) return null

  let payload: unknown
  try {
    payload = JSON.parse(base64UrlDecode(parts[1]))
  } catch {
    return null
  }

  if (typeof payload !== 'object' || payload === null) return null
  const claims = payload as Record<string, unknown>

  if (typeof claims.exp !== 'number') return null

  const role =
    typeof claims.role === 'string' &&
    (USER_ROLES as readonly string[]).includes(claims.role)
      ? (claims.role as UserRole)
      : 'user'

  return { role, exp: claims.exp }
}

function base64UrlDecode(segment: string): string {
  const padded = segment.padEnd(
    segment.length + ((4 - (segment.length % 4)) % 4),
    '=',
  )
  const base64 = padded.replace(/-/g, '+').replace(/_/g, '/')
  return Buffer.from(base64, 'base64').toString('utf-8')
}
