import { NextRequest } from 'next/server'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { InvalidTokenError } from '@/ports/auth-gateway'
import { SESSION_COOKIE_NAME } from '@/lib/session-cookie-name'
import { AccountSuspendedError, UnknownSessionUserError } from '@/services/auth'
import { ForbiddenError } from '@/services/authz'

const getCurrentUser = { execute: vi.fn() }
const becomeOwner = { execute: vi.fn() }

vi.mock('@/lib/composition', () => ({
  createServices: () => ({
    auth: { getCurrentUser },
    listers: { becomeOwner },
  }),
}))

function postRequest(cookie?: string): NextRequest {
  const headers = new Headers()
  if (cookie) headers.set('cookie', `${SESSION_COOKIE_NAME}=${cookie}`)
  return new NextRequest('https://doorstep.test/api/v1/onboarding/owner', {
    method: 'POST',
    headers,
  })
}

describe('POST /api/v1/onboarding/owner', () => {
  beforeEach(() => {
    getCurrentUser.execute.mockReset()
    becomeOwner.execute.mockReset()
  })

  afterEach(() => {
    vi.unstubAllEnvs()
  })

  it('401s with the standard envelope when there is no session cookie', async () => {
    const { POST } = await import('@/app/api/v1/onboarding/owner/route')

    const response = await POST(postRequest())

    expect(response.status).toBe(401)
    const body = await response.json()
    expect(body.error.code).toBe('unauthenticated')
    expect(getCurrentUser.execute).not.toHaveBeenCalled()
    expect(becomeOwner.execute).not.toHaveBeenCalled()
  })

  it('calls GetCurrentUser with the session cookie, then BecomeOwner with the resolved user', async () => {
    const user = { id: 'user-1', role: 'owner' }
    getCurrentUser.execute.mockResolvedValue({
      user: { id: 'user-1', role: 'user' },
      identity: {},
      reissue: false,
    })
    becomeOwner.execute.mockResolvedValue({ user })
    const { POST } = await import('@/app/api/v1/onboarding/owner/route')

    const response = await POST(postRequest('the-session-cookie'))

    expect(getCurrentUser.execute).toHaveBeenCalledWith('the-session-cookie')
    expect(becomeOwner.execute).toHaveBeenCalledWith({
      id: 'user-1',
      role: 'user',
    })
    expect(response.status).toBe(200)
    const body = await response.json()
    expect(body.data.user).toEqual(user)
  })

  it('maps ForbiddenError to 403', async () => {
    getCurrentUser.execute.mockResolvedValue({
      user: { id: 'user-1', role: 'agent' },
      identity: {},
      reissue: false,
    })
    becomeOwner.execute.mockRejectedValue(
      new ForbiddenError('Requires role user'),
    )
    const { POST } = await import('@/app/api/v1/onboarding/owner/route')

    const response = await POST(postRequest('the-session-cookie'))

    expect(response.status).toBe(403)
    const body = await response.json()
    expect(body.error.code).toBe('forbidden')
  })

  it('maps AccountSuspendedError from BecomeOwner to 403 account_suspended', async () => {
    getCurrentUser.execute.mockResolvedValue({
      user: { id: 'user-1', role: 'user' },
      identity: {},
      reissue: false,
    })
    becomeOwner.execute.mockRejectedValue(
      new AccountSuspendedError('suspended'),
    )
    const { POST } = await import('@/app/api/v1/onboarding/owner/route')

    const response = await POST(postRequest('the-session-cookie'))

    expect(response.status).toBe(403)
    const body = await response.json()
    expect(body.error.code).toBe('account_suspended')
  })

  it('maps AccountSuspendedError from GetCurrentUser to 403 account_suspended', async () => {
    getCurrentUser.execute.mockRejectedValue(
      new AccountSuspendedError('banned'),
    )
    const { POST } = await import('@/app/api/v1/onboarding/owner/route')

    const response = await POST(postRequest('the-session-cookie'))

    expect(response.status).toBe(403)
    const body = await response.json()
    expect(body.error.code).toBe('account_suspended')
    expect(becomeOwner.execute).not.toHaveBeenCalled()
  })

  it('maps an invalid/expired session cookie to 401 unauthenticated', async () => {
    getCurrentUser.execute.mockRejectedValue(
      new InvalidTokenError('cookie verification failed'),
    )
    const { POST } = await import('@/app/api/v1/onboarding/owner/route')

    const response = await POST(postRequest('garbage-cookie'))

    expect(response.status).toBe(401)
    const body = await response.json()
    expect(body.error.code).toBe('unauthenticated')
  })

  it('maps UnknownSessionUserError to 401 unauthenticated', async () => {
    getCurrentUser.execute.mockRejectedValue(new UnknownSessionUserError())
    const { POST } = await import('@/app/api/v1/onboarding/owner/route')

    const response = await POST(postRequest('stale-cookie'))

    expect(response.status).toBe(401)
    const body = await response.json()
    expect(body.error.code).toBe('unauthenticated')
  })

  it('maps unknown errors to 500 internal_error', async () => {
    const consoleError = vi
      .spyOn(console, 'error')
      .mockImplementation(() => undefined)
    getCurrentUser.execute.mockResolvedValue({
      user: { id: 'user-1', role: 'user' },
      identity: {},
      reissue: false,
    })
    becomeOwner.execute.mockRejectedValue(
      new Error('connect ECONNREFUSED 127.0.0.1:5432'),
    )
    const { POST } = await import('@/app/api/v1/onboarding/owner/route')

    const response = await POST(postRequest('the-session-cookie'))

    expect(response.status).toBe(500)
    const body = await response.json()
    expect(body.error.code).toBe('internal_error')
    expect(consoleError).toHaveBeenCalled()
    consoleError.mockRestore()
  })
})
