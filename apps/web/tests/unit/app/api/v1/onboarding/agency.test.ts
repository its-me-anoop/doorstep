import { NextRequest } from 'next/server'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { InvalidTokenError } from '@/ports/auth-gateway'
import { AgencySlugConflictError } from '@/ports/agency-repository'
import { SESSION_COOKIE_NAME } from '@/lib/session-cookie-name'
import { AccountSuspendedError, UnknownSessionUserError } from '@/services/auth'
import { ForbiddenError } from '@/services/authz'

const getCurrentUser = { execute: vi.fn() }
const createAgency = { execute: vi.fn() }

vi.mock('@/lib/composition', () => ({
  createServices: () => ({
    auth: { getCurrentUser },
    listers: { createAgency },
  }),
}))

const VALID_BODY = {
  name: 'Thameside Property Partners',
  phone: '0118 950 1147',
  email: 'hello@thamesidepropertypartners.co.uk',
  website: 'https://www.thamesidepropertypartners.co.uk',
  address: '12 Kings Road, Reading, RG1 3AA',
}

function postRequest(body: unknown, cookie?: string): NextRequest {
  const headers = new Headers({ 'Content-Type': 'application/json' })
  if (cookie) headers.set('cookie', `${SESSION_COOKIE_NAME}=${cookie}`)
  return new NextRequest('https://doorstep.test/api/v1/onboarding/agency', {
    method: 'POST',
    headers,
    body: JSON.stringify(body),
  })
}

describe('POST /api/v1/onboarding/agency', () => {
  beforeEach(() => {
    getCurrentUser.execute.mockReset()
    createAgency.execute.mockReset()
  })

  afterEach(() => {
    vi.unstubAllEnvs()
  })

  it('401s with the standard envelope when there is no session cookie', async () => {
    const { POST } = await import('@/app/api/v1/onboarding/agency/route')

    const response = await POST(postRequest(VALID_BODY))

    expect(response.status).toBe(401)
    const body = await response.json()
    expect(body.error.code).toBe('unauthenticated')
    expect(getCurrentUser.execute).not.toHaveBeenCalled()
  })

  it('400s with the standard envelope when the body fails validation, without touching the session', async () => {
    const { POST } = await import('@/app/api/v1/onboarding/agency/route')

    const response = await POST(
      postRequest({ ...VALID_BODY, name: 'A' }, 'the-session-cookie'),
    )

    expect(response.status).toBe(400)
    const body = await response.json()
    expect(body.error.code).toBe('invalid_request')
    expect(getCurrentUser.execute).not.toHaveBeenCalled()
    expect(createAgency.execute).not.toHaveBeenCalled()
  })

  it('400s when the request body is not valid JSON', async () => {
    const { POST } = await import('@/app/api/v1/onboarding/agency/route')

    const headers = new Headers({ cookie: `${SESSION_COOKIE_NAME}=cookie` })
    const request = new NextRequest(
      'https://doorstep.test/api/v1/onboarding/agency',
      { method: 'POST', headers, body: 'not-json' },
    )
    const response = await POST(request)

    expect(response.status).toBe(400)
  })

  it('calls GetCurrentUser then CreateAgency with the resolved user and parsed body', async () => {
    const actor = { id: 'user-1', role: 'user' }
    const agency = { id: 'agency-1', slug: 'thameside-property-partners' }
    getCurrentUser.execute.mockResolvedValue({
      user: actor,
      identity: {},
      reissue: false,
    })
    createAgency.execute.mockResolvedValue({
      user: { id: 'user-1', role: 'agent', agencyId: 'agency-1' },
      agency,
    })
    const { POST } = await import('@/app/api/v1/onboarding/agency/route')

    const response = await POST(postRequest(VALID_BODY, 'the-session-cookie'))

    expect(getCurrentUser.execute).toHaveBeenCalledWith('the-session-cookie')
    expect(createAgency.execute).toHaveBeenCalledWith(actor, VALID_BODY)
    expect(response.status).toBe(200)
    const body = await response.json()
    expect(body.data.user).toEqual({
      id: 'user-1',
      role: 'agent',
      agencyId: 'agency-1',
    })
    expect(body.data.agency).toEqual(agency)
  })

  it('maps ForbiddenError to 403', async () => {
    getCurrentUser.execute.mockResolvedValue({
      user: { id: 'user-1', role: 'agent' },
      identity: {},
      reissue: false,
    })
    createAgency.execute.mockRejectedValue(
      new ForbiddenError('Requires role user or owner'),
    )
    const { POST } = await import('@/app/api/v1/onboarding/agency/route')

    const response = await POST(postRequest(VALID_BODY, 'the-session-cookie'))

    expect(response.status).toBe(403)
    const body = await response.json()
    expect(body.error.code).toBe('forbidden')
  })

  it('maps AccountSuspendedError to 403 account_suspended', async () => {
    getCurrentUser.execute.mockResolvedValue({
      user: { id: 'user-1', role: 'user' },
      identity: {},
      reissue: false,
    })
    createAgency.execute.mockRejectedValue(
      new AccountSuspendedError('suspended'),
    )
    const { POST } = await import('@/app/api/v1/onboarding/agency/route')

    const response = await POST(postRequest(VALID_BODY, 'the-session-cookie'))

    expect(response.status).toBe(403)
    const body = await response.json()
    expect(body.error.code).toBe('account_suspended')
  })

  it('maps an unresolvable AgencySlugConflictError (both retry attempts collided) to 500 internal_error', async () => {
    const consoleError = vi
      .spyOn(console, 'error')
      .mockImplementation(() => undefined)
    getCurrentUser.execute.mockResolvedValue({
      user: { id: 'user-1', role: 'user' },
      identity: {},
      reissue: false,
    })
    createAgency.execute.mockRejectedValue(
      new AgencySlugConflictError('thameside-property-partners'),
    )
    const { POST } = await import('@/app/api/v1/onboarding/agency/route')

    const response = await POST(postRequest(VALID_BODY, 'the-session-cookie'))

    expect(response.status).toBe(500)
    consoleError.mockRestore()
  })

  it('maps an invalid/expired session cookie to 401 unauthenticated', async () => {
    getCurrentUser.execute.mockRejectedValue(
      new InvalidTokenError('cookie verification failed'),
    )
    const { POST } = await import('@/app/api/v1/onboarding/agency/route')

    const response = await POST(postRequest(VALID_BODY, 'garbage-cookie'))

    expect(response.status).toBe(401)
    const body = await response.json()
    expect(body.error.code).toBe('unauthenticated')
  })

  it('maps UnknownSessionUserError to 401 unauthenticated', async () => {
    getCurrentUser.execute.mockRejectedValue(new UnknownSessionUserError())
    const { POST } = await import('@/app/api/v1/onboarding/agency/route')

    const response = await POST(postRequest(VALID_BODY, 'stale-cookie'))

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
    createAgency.execute.mockRejectedValue(
      new Error('connect ECONNREFUSED 127.0.0.1:5432'),
    )
    const { POST } = await import('@/app/api/v1/onboarding/agency/route')

    const response = await POST(postRequest(VALID_BODY, 'the-session-cookie'))

    expect(response.status).toBe(500)
    const body = await response.json()
    expect(body.error.code).toBe('internal_error')
    expect(consoleError).toHaveBeenCalled()
    consoleError.mockRestore()
  })
})
