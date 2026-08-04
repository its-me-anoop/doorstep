/**
 * POST/DELETE /api/v1/auth/session — the boundary between the client
 * Firebase SDK and this app's own session cookie (PRD §8.4).
 *
 * Thin per PRD §8.5: parse the body, call a service, map the result to a
 * response. No business logic, no authorisation decision lives here —
 * EstablishSession/TerminateSession (services/auth) own all of that.
 */

import { NextResponse, type NextRequest } from 'next/server'
import { z } from 'zod'

import { apiError } from '@/lib/api-error'
import { createServices } from '@/lib/composition'
import { SESSION_COOKIE_NAME } from '@/lib/session-cookie-name'
import { InvalidTokenError } from '@/ports/auth-gateway'
import {
  AccountSuspendedError,
  MissingEmailClaimError,
  SESSION_COOKIE_LIFETIME_MS,
} from '@/services/auth'

export const establishSessionSchema = z.object({
  idToken: z.string().min(1, 'idToken is required'),
})

/** Same cookie name, same base attributes for both the "set" (POST) and
 * "clear" (DELETE) responses — only maxAge differs. */
export function sessionCookieOptions(maxAgeSeconds: number) {
  return {
    httpOnly: true,
    // Browsers reject `Secure` cookies over plain http, which local dev
    // serves over. NODE_ENV, not a guess about the request's protocol,
    // decides this — PRD §7.4.
    secure: process.env.NODE_ENV !== 'development',
    sameSite: 'lax' as const,
    path: '/',
    maxAge: maxAgeSeconds,
  }
}

export async function POST(request: NextRequest): Promise<NextResponse> {
  const rawBody: unknown = await request.json().catch(() => null)
  const parsed = establishSessionSchema.safeParse(rawBody)
  if (!parsed.success) {
    return apiError(
      400,
      'invalid_request',
      parsed.error.issues[0]?.message ?? 'Invalid request body',
    )
  }

  const { auth } = createServices()

  try {
    const { sessionCookie } = await auth.establishSession.execute({
      idToken: parsed.data.idToken,
    })

    const response = NextResponse.json({ data: { ok: true } })
    response.cookies.set(
      SESSION_COOKIE_NAME,
      sessionCookie,
      sessionCookieOptions(SESSION_COOKIE_LIFETIME_MS / 1000),
    )
    return response
  } catch (error) {
    if (error instanceof AccountSuspendedError) {
      return apiError(403, 'account_suspended', error.message)
    }
    if (
      error instanceof InvalidTokenError ||
      error instanceof MissingEmailClaimError
    ) {
      return apiError(
        401,
        'invalid_credential',
        'Could not verify the supplied ID token',
      )
    }
    // Anything else is infrastructure (unreachable database, misconfigured
    // service account) — masking it as a credential failure sends callers
    // debugging the wrong thing.
    console.error('POST /api/v1/auth/session failed:', error)
    return apiError(500, 'internal_error', 'Something went wrong on our side')
  }
}

export async function DELETE(request: NextRequest): Promise<NextResponse> {
  const cookie = request.cookies.get(SESSION_COOKIE_NAME)?.value ?? null

  const { auth } = createServices()
  await auth.terminateSession.execute(cookie)

  const response = NextResponse.json({ data: { ok: true } })
  response.cookies.set(SESSION_COOKIE_NAME, '', sessionCookieOptions(0))
  return response
}
