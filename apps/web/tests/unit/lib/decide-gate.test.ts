import { describe, expect, it } from 'vitest'

import type { UserRole } from '@/domain/enums'
import {
  decideGate,
  parseSessionClaims,
  type GateClaims,
} from '@/lib/decide-gate'

const NOW_SECONDS = 1_754_294_400 // 2026-08-04T09:00:00Z, matches currentDate

function claims(role: UserRole, exp = NOW_SECONDS + 60): GateClaims {
  return { role, exp }
}

// PRD-driven route rules under test:
//   /account   requires any live session, any role
//   /onboarding requires any live session, any role (same as /account —
//               the role-choice screen itself decides what an
//               already-onboarded owner/agent/admin sees)
//   /lister    requires any live session, any role — this proxy tier
//               deliberately does NOT role-gate any more; the real
//               owner|agent|admin check moved to the (lister) layout
//               server component, which reads the DB-backed role via
//               getSessionUser() instead of the cookie's unverified
//               claim. See lib/decide-gate.ts's doc comment for why: a
//               stale `role: user` claim survives until the client
//               completes firebase-client.ts's refreshSessionAfterUpgrade
//               dance, which requires a live Firebase user this proxy
//               tier can never have mid-session.
//   /admin     requires role admin — unchanged, still claims-gated here,
//               since /admin has no equivalent "just signed up" race: an
//               admin claim is granted out-of-band, never as the very
//               next thing a user does after landing on the gated route.
// Everything else is ungated (proxy.ts's matcher never even calls this
// for other paths, but decideGate must still behave correctly if it did).
describe('decideGate', () => {
  it('allows an unrelated path with no session at all', () => {
    expect(decideGate('/for-sale/reading', null, NOW_SECONDS)).toEqual({
      allow: true,
    })
  })

  it('allows the exact /account path for any authenticated role', () => {
    for (const role of ['user', 'owner', 'agent', 'admin'] as const) {
      expect(decideGate('/account', claims(role), NOW_SECONDS)).toEqual({
        allow: true,
      })
    }
  })

  it('allows a nested /account path for any authenticated role', () => {
    expect(
      decideGate('/account/saved-searches', claims('user'), NOW_SECONDS),
    ).toEqual({ allow: true })
  })

  it('redirects /account to sign-in with no session', () => {
    expect(decideGate('/account', null, NOW_SECONDS)).toEqual({
      allow: false,
      redirectTo: '/sign-in?next=%2Faccount',
    })
  })

  it('redirects /account to sign-in when the session has already expired', () => {
    const expired = claims('user', NOW_SECONDS - 1)
    expect(decideGate('/account', expired, NOW_SECONDS)).toEqual({
      allow: false,
      redirectTo: '/sign-in?next=%2Faccount',
    })
  })

  it('does not treat a session expiring in exactly this second as valid', () => {
    const expiringNow = claims('user', NOW_SECONDS)
    expect(decideGate('/account', expiringNow, NOW_SECONDS)).toEqual({
      allow: false,
      redirectTo: '/sign-in?next=%2Faccount',
    })
  })

  it.each(['user', 'owner', 'agent', 'admin'] as const)(
    'allows /lister for role %s — this tier only checks a live session exists, never the role',
    (role) => {
      expect(decideGate('/lister', claims(role), NOW_SECONDS)).toEqual({
        allow: true,
      })
    },
  )

  it('redirects /lister to sign-in with no session', () => {
    expect(decideGate('/lister', null, NOW_SECONDS)).toEqual({
      allow: false,
      redirectTo: '/sign-in?next=%2Flister',
    })
  })

  it('redirects /lister to sign-in when the session has already expired', () => {
    const expired = claims('user', NOW_SECONDS - 1)
    expect(decideGate('/lister', expired, NOW_SECONDS)).toEqual({
      allow: false,
      redirectTo: '/sign-in?next=%2Flister',
    })
  })

  it('allows nested /lister/listings/new for an agent', () => {
    expect(
      decideGate('/lister/listings/new', claims('agent'), NOW_SECONDS),
    ).toEqual({ allow: true })
  })

  it('allows nested /lister/listings/new for a role-user session too — the (lister) layout, not this tier, sends them on to /onboarding', () => {
    expect(
      decideGate('/lister/listings/new', claims('user'), NOW_SECONDS),
    ).toEqual({ allow: true })
  })

  it('allows /admin only for role admin', () => {
    expect(decideGate('/admin', claims('admin'), NOW_SECONDS)).toEqual({
      allow: true,
    })
  })

  it.each(['user', 'owner', 'agent'] as const)(
    'redirects /admin to sign-in for role %s',
    (role) => {
      expect(decideGate('/admin', claims(role), NOW_SECONDS)).toEqual({
        allow: false,
        redirectTo: '/sign-in?next=%2Fadmin',
      })
    },
  )

  it('redirects /admin to sign-in with no session', () => {
    expect(decideGate('/admin', null, NOW_SECONDS)).toEqual({
      allow: false,
      redirectTo: '/sign-in?next=%2Fadmin',
    })
  })

  it.each(['user', 'owner', 'agent', 'admin'] as const)(
    'allows /onboarding for any authenticated role, %s included',
    (role) => {
      expect(decideGate('/onboarding', claims(role), NOW_SECONDS)).toEqual({
        allow: true,
      })
    },
  )

  it('allows the nested /onboarding/agency path for role user', () => {
    expect(
      decideGate('/onboarding/agency', claims('user'), NOW_SECONDS),
    ).toEqual({ allow: true })
  })

  it('redirects /onboarding to sign-in with no session', () => {
    expect(decideGate('/onboarding', null, NOW_SECONDS)).toEqual({
      allow: false,
      redirectTo: '/sign-in?next=%2Fonboarding',
    })
  })

  it('redirects /onboarding to sign-in when the session has already expired', () => {
    const expired = claims('user', NOW_SECONDS - 1)
    expect(decideGate('/onboarding', expired, NOW_SECONDS)).toEqual({
      allow: false,
      redirectTo: '/sign-in?next=%2Fonboarding',
    })
  })

  it('does not match a lookalike path with no separator, e.g. /accountancy', () => {
    expect(decideGate('/accountancy', null, NOW_SECONDS)).toEqual({
      allow: true,
    })
  })

  it('URL-encodes the next parameter for a path with special characters', () => {
    expect(decideGate('/account/saved searches', null, NOW_SECONDS)).toEqual({
      allow: false,
      redirectTo: '/sign-in?next=%2Faccount%2Fsaved%20searches',
    })
  })
})

describe('parseSessionClaims', () => {
  function jwt(payload: Record<string, unknown>): string {
    const base64Url = (input: string) =>
      Buffer.from(input)
        .toString('base64')
        .replace(/\+/g, '-')
        .replace(/\//g, '_')
        .replace(/=+$/, '')
    const header = base64Url(JSON.stringify({ alg: 'RS256', typ: 'JWT' }))
    const body = base64Url(JSON.stringify(payload))
    return `${header}.${body}.fake-signature`
  }

  it('returns null when there is no cookie', () => {
    expect(parseSessionClaims(undefined)).toBeNull()
  })

  it('returns null for a malformed cookie (not a three-part JWT)', () => {
    expect(parseSessionClaims('not-a-jwt')).toBeNull()
  })

  it('returns null when the payload segment is not valid JSON', () => {
    expect(parseSessionClaims('header.not-base64-json.sig')).toBeNull()
  })

  it('returns null when the payload has no exp claim', () => {
    expect(parseSessionClaims(jwt({ role: 'admin' }))).toBeNull()
  })

  it('parses exp and defaults role to user when there is no role claim', () => {
    expect(parseSessionClaims(jwt({ exp: NOW_SECONDS }))).toEqual({
      role: 'user',
      exp: NOW_SECONDS,
    })
  })

  it('parses a valid role claim', () => {
    expect(
      parseSessionClaims(jwt({ exp: NOW_SECONDS, role: 'agent' })),
    ).toEqual({ role: 'agent', exp: NOW_SECONDS })
  })

  it('defaults role to user for an unrecognised role claim value', () => {
    expect(
      parseSessionClaims(jwt({ exp: NOW_SECONDS, role: 'superuser' })),
    ).toEqual({ role: 'user', exp: NOW_SECONDS })
  })
})
