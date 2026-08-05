import { NextRequest } from 'next/server'
import { describe, expect, it, vi } from 'vitest'

import { resolveSessionUser } from '@/lib/resolve-session-user'
import { SESSION_COOKIE_NAME } from '@/lib/session-cookie-name'

function request(cookie?: string): NextRequest {
  const headers = new Headers()
  if (cookie) headers.set('cookie', `${SESSION_COOKIE_NAME}=${cookie}`)
  return new NextRequest('https://doorstep.test/api/v1/listings', { headers })
}

// Shared by src/app/api/v1/listings/* route handlers (six of them, all
// needing the identical "read the session cookie, resolve the user"
// step) — mirrors, rather than replaces, the pattern the pre-existing
// /api/v1/onboarding/* routes each still inline: reading
// `request.cookies` directly (not lib/session.ts's next/headers-based
// getSessionUser) keeps every caller testable by mocking a plain
// GetCurrentUser-shaped object, no next/headers mock required.
describe('resolveSessionUser', () => {
  it('returns null when there is no session cookie', async () => {
    const getCurrentUser = { execute: vi.fn() }

    const result = await resolveSessionUser(request(), getCurrentUser)

    expect(result).toBeNull()
    expect(getCurrentUser.execute).not.toHaveBeenCalled()
  })

  it('calls getCurrentUser.execute with the cookie value and returns its user', async () => {
    const actor = { id: 'user-1', role: 'owner' }
    const getCurrentUser = {
      execute: vi
        .fn()
        .mockResolvedValue({ user: actor, identity: {}, reissue: false }),
    }

    const result = await resolveSessionUser(
      request('the-cookie'),
      getCurrentUser,
    )

    expect(getCurrentUser.execute).toHaveBeenCalledWith('the-cookie')
    expect(result).toBe(actor)
  })

  it('propagates a rejection from getCurrentUser.execute (e.g. InvalidTokenError)', async () => {
    const error = new Error('invalid token')
    const getCurrentUser = { execute: vi.fn().mockRejectedValue(error) }

    await expect(
      resolveSessionUser(request('garbage-cookie'), getCurrentUser),
    ).rejects.toThrow(error)
  })
})
