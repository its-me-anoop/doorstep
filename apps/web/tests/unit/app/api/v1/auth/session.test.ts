import { NextRequest } from 'next/server'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { AccountSuspendedError, MissingEmailClaimError } from '@/services/auth'

import { InvalidTokenError } from '@/ports/auth-gateway'
import { SESSION_COOKIE_NAME } from '@/lib/session-cookie-name'

const establishSession = { execute: vi.fn() }
const terminateSession = { execute: vi.fn() }

vi.mock('@/lib/composition', () => ({
  createServices: () => ({
    auth: { establishSession, terminateSession },
  }),
}))

function postRequest(body: unknown): NextRequest {
  return new NextRequest('https://doorstep.test/api/v1/auth/session', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
}

function deleteRequest(cookie?: string): NextRequest {
  const headers = new Headers()
  if (cookie) headers.set('cookie', `${SESSION_COOKIE_NAME}=${cookie}`)
  return new NextRequest('https://doorstep.test/api/v1/auth/session', {
    method: 'DELETE',
    headers,
  })
}

describe('POST /api/v1/auth/session', () => {
  beforeEach(() => {
    establishSession.execute.mockReset()
    terminateSession.execute.mockReset()
  })

  afterEach(() => {
    vi.unstubAllEnvs()
  })

  it('400s with the standard error envelope when idToken is missing', async () => {
    const { POST } = await import('@/app/api/v1/auth/session/route')

    const response = await POST(postRequest({}))

    expect(response.status).toBe(400)
    const body = await response.json()
    expect(body.error.code).toBe('invalid_request')
    expect(establishSession.execute).not.toHaveBeenCalled()
  })

  it('400s when the request body is not valid JSON', async () => {
    const { POST } = await import('@/app/api/v1/auth/session/route')

    const request = new NextRequest(
      'https://doorstep.test/api/v1/auth/session',
      { method: 'POST', body: 'not-json' },
    )
    const response = await POST(request)

    expect(response.status).toBe(400)
  })

  it('sets an HttpOnly, SameSite=Lax session cookie on success', async () => {
    establishSession.execute.mockResolvedValue({
      sessionCookie: 'the-session-cookie',
      user: { id: 'user-1' },
      expiresAt: new Date(),
    })
    const { POST } = await import('@/app/api/v1/auth/session/route')

    const response = await POST(postRequest({ idToken: 'valid-id-token' }))

    expect(response.status).toBe(200)
    expect(establishSession.execute).toHaveBeenCalledWith({
      idToken: 'valid-id-token',
    })

    const setCookie = response.headers.get('set-cookie') ?? ''
    expect(setCookie).toContain(`${SESSION_COOKIE_NAME}=the-session-cookie`)
    expect(setCookie).toContain('HttpOnly')
    expect(setCookie).toContain('SameSite=lax')
    expect(setCookie).toContain('Path=/')
    expect(setCookie).toContain('Max-Age=1209600') // 14 days, in seconds
  })

  it('omits Secure in development but sets it otherwise', async () => {
    establishSession.execute.mockResolvedValue({
      sessionCookie: 'cookie',
      user: { id: 'user-1' },
      expiresAt: new Date(),
    })
    vi.stubEnv('NODE_ENV', 'development')
    const { POST } = await import('@/app/api/v1/auth/session/route')

    const response = await POST(postRequest({ idToken: 'valid-id-token' }))
    expect(response.headers.get('set-cookie') ?? '').not.toContain('Secure')
  })

  it('maps AccountSuspendedError to 403 with the standard envelope', async () => {
    establishSession.execute.mockRejectedValue(
      new AccountSuspendedError('suspended'),
    )
    const { POST } = await import('@/app/api/v1/auth/session/route')

    const response = await POST(postRequest({ idToken: 'valid-id-token' }))

    expect(response.status).toBe(403)
    const body = await response.json()
    expect(body.error.code).toBe('account_suspended')
  })

  it('maps InvalidTokenError to 401 invalid_credential', async () => {
    establishSession.execute.mockRejectedValue(
      new InvalidTokenError('token verification failed'),
    )
    const { POST } = await import('@/app/api/v1/auth/session/route')

    const response = await POST(postRequest({ idToken: 'garbage' }))

    expect(response.status).toBe(401)
    const body = await response.json()
    expect(body.error.code).toBe('invalid_credential')
  })

  it('maps MissingEmailClaimError to 401 invalid_credential', async () => {
    establishSession.execute.mockRejectedValue(new MissingEmailClaimError())
    const { POST } = await import('@/app/api/v1/auth/session/route')

    const response = await POST(postRequest({ idToken: 'no-email-token' }))

    expect(response.status).toBe(401)
    const body = await response.json()
    expect(body.error.code).toBe('invalid_credential')
  })

  it('maps unknown errors (e.g. an unreachable database) to 500 internal_error, not 401', async () => {
    const consoleError = vi
      .spyOn(console, 'error')
      .mockImplementation(() => undefined)
    establishSession.execute.mockRejectedValue(
      new Error('connect ECONNREFUSED 127.0.0.1:5432'),
    )
    const { POST } = await import('@/app/api/v1/auth/session/route')

    const response = await POST(postRequest({ idToken: 'valid-id-token' }))

    expect(response.status).toBe(500)
    const body = await response.json()
    expect(body.error.code).toBe('internal_error')
    expect(consoleError).toHaveBeenCalled()
    consoleError.mockRestore()
  })
})

describe('DELETE /api/v1/auth/session', () => {
  beforeEach(() => {
    establishSession.execute.mockReset()
    terminateSession.execute.mockReset()
    terminateSession.execute.mockResolvedValue(undefined)
  })

  it('calls TerminateSession with the cookie and clears it', async () => {
    const { DELETE } = await import('@/app/api/v1/auth/session/route')

    const response = await DELETE(deleteRequest('the-session-cookie'))

    expect(terminateSession.execute).toHaveBeenCalledWith('the-session-cookie')
    expect(response.status).toBe(200)
    const setCookie = response.headers.get('set-cookie') ?? ''
    expect(setCookie).toContain(`${SESSION_COOKIE_NAME}=;`)
    expect(setCookie).toMatch(/Max-Age=0/)
  })

  it('calls TerminateSession with null when there is no cookie', async () => {
    const { DELETE } = await import('@/app/api/v1/auth/session/route')

    await DELETE(deleteRequest())

    expect(terminateSession.execute).toHaveBeenCalledWith(null)
  })
})
