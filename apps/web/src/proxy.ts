/**
 * proxy.ts — Next.js 16's rename of the `middleware.ts` convention (the
 * `middleware` filename and its `middleware` export are deprecated in
 * this version; see
 * node_modules/next/dist/docs/01-app/02-guides/upgrading/version-16.md,
 * "middleware to proxy"). Runs before every request matched by `config`
 * below.
 *
 * Route gating ONLY — see lib/decide-gate.ts's doc comment for the full
 * explanation of why this deliberately does NOT cryptographically verify
 * the session cookie (PRD §7.4, §8.4: "Middleware decodes, services
 * verify"). This file's only job is to turn a request into a pathname
 * and an unverified claims guess, then ask decideGate what to do about
 * it — it never makes the gating decision itself.
 */

import { NextResponse, type NextRequest } from 'next/server'

import { decideGate, parseSessionClaims } from '@/lib/decide-gate'
import { SESSION_COOKIE_NAME } from '@/lib/session-cookie-name'

export function proxy(request: NextRequest): NextResponse {
  const cookieValue = request.cookies.get(SESSION_COOKIE_NAME)?.value
  const claims = parseSessionClaims(cookieValue)

  const decision = decideGate(
    request.nextUrl.pathname,
    claims,
    Math.floor(Date.now() / 1000),
  )

  if (decision.allow) {
    return NextResponse.next()
  }

  return NextResponse.redirect(new URL(decision.redirectTo, request.url))
}

export const config = {
  matcher: [
    '/account/:path*',
    '/lister/:path*',
    '/admin/:path*',
    '/onboarding/:path*',
  ],
}
