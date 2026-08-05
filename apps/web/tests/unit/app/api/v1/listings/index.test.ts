import { NextRequest } from 'next/server'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { InvalidTokenError } from '@/ports/auth-gateway'
import { SESSION_COOKIE_NAME } from '@/lib/session-cookie-name'
import { AccountSuspendedError, UnknownSessionUserError } from '@/services/auth'
import { ForbiddenError } from '@/services/authz'

const getCurrentUser = { execute: vi.fn() }
const createListingDraft = { execute: vi.fn() }
const listMyListings = { execute: vi.fn() }

vi.mock('@/lib/composition', () => ({
  createServices: () => ({
    auth: { getCurrentUser },
    listings: { createListingDraft, listMyListings },
  }),
}))

function getRequest(cookie?: string, search = ''): NextRequest {
  const headers = new Headers()
  if (cookie) headers.set('cookie', `${SESSION_COOKIE_NAME}=${cookie}`)
  return new NextRequest(`https://doorstep.test/api/v1/listings${search}`, {
    headers,
  })
}

function postRequest(body: unknown, cookie?: string): NextRequest {
  const headers = new Headers({ 'Content-Type': 'application/json' })
  if (cookie) headers.set('cookie', `${SESSION_COOKIE_NAME}=${cookie}`)
  return new NextRequest('https://doorstep.test/api/v1/listings', {
    method: 'POST',
    headers,
    body: JSON.stringify(body),
  })
}

describe('GET /api/v1/listings', () => {
  beforeEach(() => {
    getCurrentUser.execute.mockReset()
    listMyListings.execute.mockReset()
  })

  it('401s with the standard envelope when there is no session cookie', async () => {
    const { GET } = await import('@/app/api/v1/listings/route')

    const response = await GET(getRequest())

    expect(response.status).toBe(401)
    const body = await response.json()
    expect(body.error.code).toBe('unauthenticated')
    expect(listMyListings.execute).not.toHaveBeenCalled()
  })

  it('returns {data, nextCursor} from ListMyListings', async () => {
    getCurrentUser.execute.mockResolvedValue({
      user: { id: 'user-1', role: 'owner' },
      identity: {},
      reissue: false,
    })
    listMyListings.execute.mockResolvedValue({
      data: [{ id: 'listing-1' }],
      nextCursor: 'listing-1',
    })
    const { GET } = await import('@/app/api/v1/listings/route')

    const response = await GET(getRequest('the-cookie'))

    expect(response.status).toBe(200)
    const body = await response.json()
    expect(body).toEqual({
      data: [{ id: 'listing-1' }],
      nextCursor: 'listing-1',
    })
  })

  it('passes cursor and limit query params through to the service', async () => {
    getCurrentUser.execute.mockResolvedValue({
      user: { id: 'user-1', role: 'owner' },
      identity: {},
      reissue: false,
    })
    listMyListings.execute.mockResolvedValue({ data: [], nextCursor: null })
    const { GET } = await import('@/app/api/v1/listings/route')

    await GET(getRequest('the-cookie', '?cursor=listing-5&limit=10'))

    expect(listMyListings.execute).toHaveBeenCalledWith(
      { id: 'user-1', role: 'owner' },
      { cursor: 'listing-5', limit: 10 },
    )
  })

  it('maps ForbiddenError to 403', async () => {
    getCurrentUser.execute.mockResolvedValue({
      user: { id: 'user-1', role: 'user' },
      identity: {},
      reissue: false,
    })
    listMyListings.execute.mockRejectedValue(new ForbiddenError())
    const { GET } = await import('@/app/api/v1/listings/route')

    const response = await GET(getRequest('the-cookie'))

    expect(response.status).toBe(403)
  })

  it('maps an invalid session cookie to 401', async () => {
    getCurrentUser.execute.mockRejectedValue(new InvalidTokenError('bad'))
    const { GET } = await import('@/app/api/v1/listings/route')

    const response = await GET(getRequest('garbage'))

    expect(response.status).toBe(401)
  })
})

describe('POST /api/v1/listings', () => {
  beforeEach(() => {
    getCurrentUser.execute.mockReset()
    createListingDraft.execute.mockReset()
  })

  afterEach(() => {
    vi.unstubAllEnvs()
  })

  it('401s when there is no session cookie, without touching the body or the service', async () => {
    const { POST } = await import('@/app/api/v1/listings/route')

    const response = await POST(
      postRequest({ channel: 'sale', propertyType: 'flat' }),
    )

    expect(response.status).toBe(401)
    expect(createListingDraft.execute).not.toHaveBeenCalled()
  })

  it('400s when the body fails validation', async () => {
    const { POST } = await import('@/app/api/v1/listings/route')

    const response = await POST(
      postRequest({ channel: 'not-a-channel' }, 'the-cookie'),
    )

    expect(response.status).toBe(400)
    const body = await response.json()
    expect(body.error.code).toBe('invalid_request')
  })

  it('400s when the request body is not valid JSON', async () => {
    const headers = new Headers({ cookie: `${SESSION_COOKIE_NAME}=cookie` })
    const request = new NextRequest('https://doorstep.test/api/v1/listings', {
      method: 'POST',
      headers,
      body: 'not-json',
    })
    const { POST } = await import('@/app/api/v1/listings/route')

    const response = await POST(request)

    expect(response.status).toBe(400)
  })

  it('creates a draft and returns 201 with {data: {listing}}', async () => {
    const actor = { id: 'user-1', role: 'owner' }
    const draft = { id: 'listing-1', status: 'draft' }
    getCurrentUser.execute.mockResolvedValue({
      user: actor,
      identity: {},
      reissue: false,
    })
    createListingDraft.execute.mockResolvedValue(draft)
    const { POST } = await import('@/app/api/v1/listings/route')

    const response = await POST(
      postRequest({ channel: 'sale', propertyType: 'flat' }, 'the-cookie'),
    )

    expect(createListingDraft.execute).toHaveBeenCalledWith(actor, {
      channel: 'sale',
      propertyType: 'flat',
    })
    expect(response.status).toBe(201)
    const body = await response.json()
    expect(body.data.listing).toEqual(draft)
  })

  it('maps ForbiddenError to 403', async () => {
    getCurrentUser.execute.mockResolvedValue({
      user: { id: 'user-1', role: 'user' },
      identity: {},
      reissue: false,
    })
    createListingDraft.execute.mockRejectedValue(new ForbiddenError())
    const { POST } = await import('@/app/api/v1/listings/route')

    const response = await POST(
      postRequest({ channel: 'sale', propertyType: 'flat' }, 'the-cookie'),
    )

    expect(response.status).toBe(403)
  })

  it('maps AccountSuspendedError to 403 account_suspended', async () => {
    getCurrentUser.execute.mockResolvedValue({
      user: { id: 'user-1', role: 'owner' },
      identity: {},
      reissue: false,
    })
    createListingDraft.execute.mockRejectedValue(
      new AccountSuspendedError('suspended'),
    )
    const { POST } = await import('@/app/api/v1/listings/route')

    const response = await POST(
      postRequest({ channel: 'sale', propertyType: 'flat' }, 'the-cookie'),
    )

    expect(response.status).toBe(403)
    const body = await response.json()
    expect(body.error.code).toBe('account_suspended')
  })

  it('maps UnknownSessionUserError to 401', async () => {
    getCurrentUser.execute.mockRejectedValue(new UnknownSessionUserError())
    const { POST } = await import('@/app/api/v1/listings/route')

    const response = await POST(
      postRequest({ channel: 'sale', propertyType: 'flat' }, 'stale-cookie'),
    )

    expect(response.status).toBe(401)
  })

  it('maps unknown errors to 500 internal_error', async () => {
    const consoleError = vi
      .spyOn(console, 'error')
      .mockImplementation(() => undefined)
    getCurrentUser.execute.mockResolvedValue({
      user: { id: 'user-1', role: 'owner' },
      identity: {},
      reissue: false,
    })
    createListingDraft.execute.mockRejectedValue(new Error('ECONNREFUSED'))
    const { POST } = await import('@/app/api/v1/listings/route')

    const response = await POST(
      postRequest({ channel: 'sale', propertyType: 'flat' }, 'the-cookie'),
    )

    expect(response.status).toBe(500)
    consoleError.mockRestore()
  })
})
