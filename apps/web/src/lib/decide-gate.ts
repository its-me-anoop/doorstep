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
  { prefix: '/lister', roles: ['owner', 'agent', 'admin'] },
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
