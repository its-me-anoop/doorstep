import { NextRequest } from 'next/server'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { InvalidTransitionError } from '@/domain/property-status-machine'
import { SESSION_COOKIE_NAME } from '@/lib/session-cookie-name'
import { ListingNotFoundError } from '@/ports/listing-repository'
import { ForbiddenError } from '@/services/authz'
import { ListingIncompleteError } from '@/services/listings'

const getCurrentUser = { execute: vi.fn() }
const submitListing = { execute: vi.fn() }

vi.mock('@/lib/composition', () => ({
  createServices: () => ({
    auth: { getCurrentUser },
    listings: { submitListing },
  }),
}))

function postRequest(cookie?: string): NextRequest {
  const headers = new Headers()
  if (cookie) headers.set('cookie', `${SESSION_COOKIE_NAME}=${cookie}`)
  return new NextRequest(
    'https://doorstep.test/api/v1/listings/listing-1/submit',
    { method: 'POST', headers },
  )
}

function ctx(id = 'listing-1') {
  return { params: Promise.resolve({ id }) }
}

describe('POST /api/v1/listings/[id]/submit', () => {
  beforeEach(() => {
    getCurrentUser.execute.mockReset()
    submitListing.execute.mockReset()
  })

  it('401s with no session cookie', async () => {
    const { POST } = await import('@/app/api/v1/listings/[id]/submit/route')

    const response = await POST(postRequest(), ctx())

    expect(response.status).toBe(401)
    expect(submitListing.execute).not.toHaveBeenCalled()
  })

  it('submits and returns {data: {listing}} on success', async () => {
    const actor = { id: 'user-1', role: 'owner' }
    const listing = { id: 'listing-1', status: 'pending_review' }
    getCurrentUser.execute.mockResolvedValue({
      user: actor,
      identity: {},
      reissue: false,
    })
    submitListing.execute.mockResolvedValue(listing)
    const { POST } = await import('@/app/api/v1/listings/[id]/submit/route')

    const response = await POST(postRequest('the-cookie'), ctx('listing-1'))

    expect(submitListing.execute).toHaveBeenCalledWith(actor, 'listing-1')
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
    submitListing.execute.mockRejectedValue(
      new ListingNotFoundError('listing-1'),
    )
    const { POST } = await import('@/app/api/v1/listings/[id]/submit/route')

    const response = await POST(postRequest('the-cookie'), ctx())

    expect(response.status).toBe(404)
    const body = await response.json()
    expect(body.error.code).toBe('not_found')
  })

  it('maps ForbiddenError to 403', async () => {
    getCurrentUser.execute.mockResolvedValue({
      user: { id: 'user-1', role: 'user' },
      identity: {},
      reissue: false,
    })
    submitListing.execute.mockRejectedValue(new ForbiddenError())
    const { POST } = await import('@/app/api/v1/listings/[id]/submit/route')

    const response = await POST(postRequest('the-cookie'), ctx())

    expect(response.status).toBe(403)
  })

  it('maps InvalidTransitionError to 409', async () => {
    getCurrentUser.execute.mockResolvedValue({
      user: { id: 'user-1', role: 'owner' },
      identity: {},
      reissue: false,
    })
    submitListing.execute.mockRejectedValue(
      new InvalidTransitionError('published', 'pending_review'),
    )
    const { POST } = await import('@/app/api/v1/listings/[id]/submit/route')

    const response = await POST(postRequest('the-cookie'), ctx())

    expect(response.status).toBe(409)
    const body = await response.json()
    expect(body.error.code).toBe('invalid_transition')
  })

  it('maps ListingIncompleteError to 400 with the first missing field surfaced', async () => {
    getCurrentUser.execute.mockResolvedValue({
      user: { id: 'user-1', role: 'owner' },
      identity: {},
      reissue: false,
    })
    submitListing.execute.mockRejectedValue(
      new ListingIncompleteError([
        { path: 'tenure', message: 'Tenure is required for sale listings.' },
      ]),
    )
    const { POST } = await import('@/app/api/v1/listings/[id]/submit/route')

    const response = await POST(postRequest('the-cookie'), ctx())

    expect(response.status).toBe(400)
    const body = await response.json()
    expect(body.error.code).toBe('listing_incomplete')
    expect(body.error.message).toContain(
      'Tenure is required for sale listings.',
    )
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
    submitListing.execute.mockRejectedValue(new Error('boom'))
    const { POST } = await import('@/app/api/v1/listings/[id]/submit/route')

    const response = await POST(postRequest('the-cookie'), ctx())

    expect(response.status).toBe(500)
    consoleError.mockRestore()
  })
})
