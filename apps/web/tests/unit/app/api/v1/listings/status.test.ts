import { NextRequest } from 'next/server'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { InvalidTransitionError } from '@/domain/property-status-machine'
import { SESSION_COOKIE_NAME } from '@/lib/session-cookie-name'
import { ListingNotFoundError } from '@/ports/listing-repository'
import { ForbiddenError } from '@/services/authz'
import { ListingActionChannelMismatchError } from '@/services/listings'

const getCurrentUser = { execute: vi.fn() }
const changeListingStatus = { execute: vi.fn() }

vi.mock('@/lib/composition', () => ({
  createServices: () => ({
    auth: { getCurrentUser },
    listings: { changeListingStatus },
  }),
}))

function postRequest(body: unknown, cookie?: string): NextRequest {
  const headers = new Headers({ 'Content-Type': 'application/json' })
  if (cookie) headers.set('cookie', `${SESSION_COOKIE_NAME}=${cookie}`)
  return new NextRequest(
    'https://doorstep.test/api/v1/listings/listing-1/status',
    { method: 'POST', headers, body: JSON.stringify(body) },
  )
}

function ctx(id = 'listing-1') {
  return { params: Promise.resolve({ id }) }
}

describe('POST /api/v1/listings/[id]/status', () => {
  beforeEach(() => {
    getCurrentUser.execute.mockReset()
    changeListingStatus.execute.mockReset()
  })

  it('401s with no session cookie, without touching the body', async () => {
    const { POST } = await import('@/app/api/v1/listings/[id]/status/route')

    const response = await POST(postRequest({ action: 'hide' }), ctx())

    expect(response.status).toBe(401)
    expect(changeListingStatus.execute).not.toHaveBeenCalled()
  })

  it('400s when the body fails validation', async () => {
    const { POST } = await import('@/app/api/v1/listings/[id]/status/route')

    const response = await POST(
      postRequest({ action: 'delete' }, 'the-cookie'),
      ctx(),
    )

    expect(response.status).toBe(400)
    expect(changeListingStatus.execute).not.toHaveBeenCalled()
  })

  it('changes status and returns {data: {listing}}', async () => {
    const actor = { id: 'user-1', role: 'owner' }
    const listing = { id: 'listing-1', status: 'hidden' }
    getCurrentUser.execute.mockResolvedValue({
      user: actor,
      identity: {},
      reissue: false,
    })
    changeListingStatus.execute.mockResolvedValue(listing)
    const { POST } = await import('@/app/api/v1/listings/[id]/status/route')

    const response = await POST(
      postRequest({ action: 'hide' }, 'the-cookie'),
      ctx('listing-1'),
    )

    expect(changeListingStatus.execute).toHaveBeenCalledWith(
      actor,
      'listing-1',
      'hide',
    )
    expect(response.status).toBe(200)
    const body = await response.json()
    expect(body.data.listing).toEqual(listing)
  })

  it('maps ListingNotFoundError to 404', async () => {
    getCurrentUser.execute.mockResolvedValue({
      user: { id: 'user-1', role: 'owner' },
      identity: {},
      reissue: false,
    })
    changeListingStatus.execute.mockRejectedValue(
      new ListingNotFoundError('listing-1'),
    )
    const { POST } = await import('@/app/api/v1/listings/[id]/status/route')

    const response = await POST(
      postRequest({ action: 'hide' }, 'the-cookie'),
      ctx(),
    )

    expect(response.status).toBe(404)
  })

  it('maps ForbiddenError to 403', async () => {
    getCurrentUser.execute.mockResolvedValue({
      user: { id: 'user-1', role: 'user' },
      identity: {},
      reissue: false,
    })
    changeListingStatus.execute.mockRejectedValue(new ForbiddenError())
    const { POST } = await import('@/app/api/v1/listings/[id]/status/route')

    const response = await POST(
      postRequest({ action: 'hide' }, 'the-cookie'),
      ctx(),
    )

    expect(response.status).toBe(403)
  })

  it('maps InvalidTransitionError to 409', async () => {
    getCurrentUser.execute.mockResolvedValue({
      user: { id: 'user-1', role: 'owner' },
      identity: {},
      reissue: false,
    })
    changeListingStatus.execute.mockRejectedValue(
      new InvalidTransitionError('draft', 'hidden'),
    )
    const { POST } = await import('@/app/api/v1/listings/[id]/status/route')

    const response = await POST(
      postRequest({ action: 'hide' }, 'the-cookie'),
      ctx(),
    )

    expect(response.status).toBe(409)
    const body = await response.json()
    expect(body.error.code).toBe('invalid_transition')
  })

  it('maps ListingActionChannelMismatchError to 400', async () => {
    getCurrentUser.execute.mockResolvedValue({
      user: { id: 'user-1', role: 'owner' },
      identity: {},
      reissue: false,
    })
    changeListingStatus.execute.mockRejectedValue(
      new ListingActionChannelMismatchError('sold_stc', 'rent'),
    )
    const { POST } = await import('@/app/api/v1/listings/[id]/status/route')

    const response = await POST(
      postRequest({ action: 'sold_stc' }, 'the-cookie'),
      ctx(),
    )

    expect(response.status).toBe(400)
    const body = await response.json()
    expect(body.error.code).toBe('invalid_request')
  })

  it('maps unknown errors to 500', async () => {
    const consoleError = vi
      .spyOn(console, 'error')
      .mockImplementation(() => undefined)
    getCurrentUser.execute.mockResolvedValue({
      user: { id: 'user-1', role: 'owner' },
      identity: {},
      reissue: false,
    })
    changeListingStatus.execute.mockRejectedValue(new Error('boom'))
    const { POST } = await import('@/app/api/v1/listings/[id]/status/route')

    const response = await POST(
      postRequest({ action: 'hide' }, 'the-cookie'),
      ctx(),
    )

    expect(response.status).toBe(500)
    consoleError.mockRestore()
  })
})
