import { NextRequest } from 'next/server'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { SESSION_COOKIE_NAME } from '@/lib/session-cookie-name'
import { ListingNotFoundError } from '@/ports/listing-repository'
import { ForbiddenError } from '@/services/authz'
import {
  ListingChannelImmutableError,
  ListingNotDeletableError,
  ListingNotEditableError,
} from '@/services/listings'

const getCurrentUser = { execute: vi.fn() }
const getListing = { execute: vi.fn() }
const updateListing = { execute: vi.fn() }
const deleteListing = { execute: vi.fn() }

vi.mock('@/lib/composition', () => ({
  createServices: () => ({
    auth: { getCurrentUser },
    listings: { getListing, updateListing, deleteListing },
  }),
}))

const revalidatePathMock = vi.fn()
vi.mock('next/cache', () => ({
  revalidatePath: (path: string) => revalidatePathMock(path),
}))

function getRequest(cookie?: string): NextRequest {
  const headers = new Headers()
  if (cookie) headers.set('cookie', `${SESSION_COOKIE_NAME}=${cookie}`)
  return new NextRequest('https://doorstep.test/api/v1/listings/listing-1', {
    headers,
  })
}

function patchRequest(body: unknown, cookie?: string): NextRequest {
  const headers = new Headers({ 'Content-Type': 'application/json' })
  if (cookie) headers.set('cookie', `${SESSION_COOKIE_NAME}=${cookie}`)
  return new NextRequest('https://doorstep.test/api/v1/listings/listing-1', {
    method: 'PATCH',
    headers,
    body: JSON.stringify(body),
  })
}

function deleteRequest(cookie?: string): NextRequest {
  const headers = new Headers()
  if (cookie) headers.set('cookie', `${SESSION_COOKIE_NAME}=${cookie}`)
  return new NextRequest('https://doorstep.test/api/v1/listings/listing-1', {
    method: 'DELETE',
    headers,
  })
}

function ctx(id = 'listing-1') {
  return { params: Promise.resolve({ id }) }
}

describe('GET /api/v1/listings/[id]', () => {
  beforeEach(() => {
    getCurrentUser.execute.mockReset()
    getListing.execute.mockReset()
  })

  it('401s with no session cookie', async () => {
    const { GET } = await import('@/app/api/v1/listings/[id]/route')

    const response = await GET(getRequest(), ctx())

    expect(response.status).toBe(401)
    expect(getListing.execute).not.toHaveBeenCalled()
  })

  it('returns {data: {listing}} on success', async () => {
    const actor = { id: 'user-1', role: 'owner' }
    const listing = { id: 'listing-1' }
    getCurrentUser.execute.mockResolvedValue({
      user: actor,
      identity: {},
      reissue: false,
    })
    getListing.execute.mockResolvedValue(listing)
    const { GET } = await import('@/app/api/v1/listings/[id]/route')

    const response = await GET(getRequest('the-cookie'), ctx('listing-1'))

    expect(getListing.execute).toHaveBeenCalledWith(actor, 'listing-1')
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
    getListing.execute.mockRejectedValue(new ListingNotFoundError('listing-1'))
    const { GET } = await import('@/app/api/v1/listings/[id]/route')

    const response = await GET(getRequest('the-cookie'), ctx())

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
    getListing.execute.mockRejectedValue(new ForbiddenError())
    const { GET } = await import('@/app/api/v1/listings/[id]/route')

    const response = await GET(getRequest('the-cookie'), ctx())

    expect(response.status).toBe(403)
  })
})

describe('PATCH /api/v1/listings/[id]', () => {
  beforeEach(() => {
    getCurrentUser.execute.mockReset()
    updateListing.execute.mockReset()
    revalidatePathMock.mockClear()
  })

  it('401s with no session cookie, without touching the body', async () => {
    const { PATCH } = await import('@/app/api/v1/listings/[id]/route')

    const response = await PATCH(
      patchRequest({ channel: 'sale', propertyType: 'flat' }),
      ctx(),
    )

    expect(response.status).toBe(401)
    expect(updateListing.execute).not.toHaveBeenCalled()
  })

  it('400s when the body fails validation', async () => {
    const { PATCH } = await import('@/app/api/v1/listings/[id]/route')

    const response = await PATCH(
      patchRequest({ channel: 'nope' }, 'the-cookie'),
      ctx(),
    )

    expect(response.status).toBe(400)
  })

  it('updates and returns {data: {listing}}', async () => {
    const actor = { id: 'user-1', role: 'owner' }
    const updated = { id: 'listing-1', description: 'Updated.' }
    getCurrentUser.execute.mockResolvedValue({
      user: actor,
      identity: {},
      reissue: false,
    })
    updateListing.execute.mockResolvedValue(updated)
    const { PATCH } = await import('@/app/api/v1/listings/[id]/route')

    const response = await PATCH(
      patchRequest(
        { channel: 'sale', propertyType: 'flat', description: 'Updated.' },
        'the-cookie',
      ),
      ctx('listing-1'),
    )

    expect(updateListing.execute).toHaveBeenCalledWith(actor, 'listing-1', {
      channel: 'sale',
      propertyType: 'flat',
      description: 'Updated.',
    })
    expect(response.status).toBe(200)
    const body = await response.json()
    expect(body.data.listing).toEqual(updated)
  })

  // PRD §8.3's on-demand ISR: a PATCH to an already-visible listing can
  // change facts shown on its detail page (and, indirectly, its area
  // page's strip), so it revalidates both — see
  // lib/listing-revalidation.ts.
  it('revalidates the detail page when the updated listing is published', async () => {
    const actor = { id: 'user-1', role: 'owner' }
    getCurrentUser.execute.mockResolvedValue({
      user: actor,
      identity: {},
      reissue: false,
    })
    updateListing.execute.mockResolvedValue({
      id: 'listing-1',
      status: 'published',
      slug: 'a-slug',
      channel: 'sale',
      town: 'Reading',
      outcode: 'RG1',
    })
    const { PATCH } = await import('@/app/api/v1/listings/[id]/route')

    await PATCH(
      patchRequest({ channel: 'sale', propertyType: 'flat' }, 'the-cookie'),
      ctx('listing-1'),
    )

    expect(revalidatePathMock).toHaveBeenCalledWith('/property/a-slug')
    expect(revalidatePathMock).toHaveBeenCalledWith('/for-sale/reading')
  })

  it('does not revalidate anything for a draft (never publicly visible)', async () => {
    getCurrentUser.execute.mockResolvedValue({
      user: { id: 'user-1', role: 'owner' },
      identity: {},
      reissue: false,
    })
    updateListing.execute.mockResolvedValue({
      id: 'listing-1',
      status: 'draft',
      slug: 'a-slug',
      channel: 'sale',
      town: 'Reading',
      outcode: 'RG1',
    })
    const { PATCH } = await import('@/app/api/v1/listings/[id]/route')

    await PATCH(
      patchRequest({ channel: 'sale', propertyType: 'flat' }, 'the-cookie'),
      ctx('listing-1'),
    )

    expect(revalidatePathMock).not.toHaveBeenCalled()
  })

  it('maps ListingNotFoundError to 404', async () => {
    getCurrentUser.execute.mockResolvedValue({
      user: { id: 'user-1', role: 'owner' },
      identity: {},
      reissue: false,
    })
    updateListing.execute.mockRejectedValue(
      new ListingNotFoundError('listing-1'),
    )
    const { PATCH } = await import('@/app/api/v1/listings/[id]/route')

    const response = await PATCH(
      patchRequest({ channel: 'sale', propertyType: 'flat' }, 'the-cookie'),
      ctx(),
    )

    expect(response.status).toBe(404)
  })

  it('maps ListingNotEditableError to 409', async () => {
    getCurrentUser.execute.mockResolvedValue({
      user: { id: 'user-1', role: 'owner' },
      identity: {},
      reissue: false,
    })
    updateListing.execute.mockRejectedValue(
      new ListingNotEditableError('hidden'),
    )
    const { PATCH } = await import('@/app/api/v1/listings/[id]/route')

    const response = await PATCH(
      patchRequest({ channel: 'sale', propertyType: 'flat' }, 'the-cookie'),
      ctx(),
    )

    expect(response.status).toBe(409)
    const body = await response.json()
    expect(body.error.code).toBe('listing_not_editable')
  })

  it('maps ListingChannelImmutableError to 400', async () => {
    getCurrentUser.execute.mockResolvedValue({
      user: { id: 'user-1', role: 'owner' },
      identity: {},
      reissue: false,
    })
    updateListing.execute.mockRejectedValue(new ListingChannelImmutableError())
    const { PATCH } = await import('@/app/api/v1/listings/[id]/route')

    const response = await PATCH(
      patchRequest({ channel: 'rent', propertyType: 'flat' }, 'the-cookie'),
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
    updateListing.execute.mockRejectedValue(new Error('boom'))
    const { PATCH } = await import('@/app/api/v1/listings/[id]/route')

    const response = await PATCH(
      patchRequest({ channel: 'sale', propertyType: 'flat' }, 'the-cookie'),
      ctx(),
    )

    expect(response.status).toBe(500)
    consoleError.mockRestore()
  })
})

// DELETE /api/v1/listings/[id] — the M1-DESIGN-SPEC.md §4.3/§4.4 "Delete
// draft" dashboard action, and this API's one M1 contract addition beyond
// the PRD's original surface (services/listings/delete-listing.ts's doc
// comment).
describe('DELETE /api/v1/listings/[id]', () => {
  beforeEach(() => {
    getCurrentUser.execute.mockReset()
    deleteListing.execute.mockReset()
  })

  it('401s with no session cookie', async () => {
    const { DELETE } = await import('@/app/api/v1/listings/[id]/route')

    const response = await DELETE(deleteRequest(), ctx())

    expect(response.status).toBe(401)
    expect(deleteListing.execute).not.toHaveBeenCalled()
  })

  it('deletes and returns {data: {deleted: true}}', async () => {
    const actor = { id: 'user-1', role: 'owner' }
    getCurrentUser.execute.mockResolvedValue({
      user: actor,
      identity: {},
      reissue: false,
    })
    deleteListing.execute.mockResolvedValue(undefined)
    const { DELETE } = await import('@/app/api/v1/listings/[id]/route')

    const response = await DELETE(deleteRequest('the-cookie'), ctx('listing-1'))

    expect(deleteListing.execute).toHaveBeenCalledWith(actor, 'listing-1')
    expect(response.status).toBe(200)
    const body = await response.json()
    expect(body.data).toEqual({ deleted: true })
  })

  it('maps ListingNotFoundError to 404', async () => {
    getCurrentUser.execute.mockResolvedValue({
      user: { id: 'user-1', role: 'owner' },
      identity: {},
      reissue: false,
    })
    deleteListing.execute.mockRejectedValue(
      new ListingNotFoundError('listing-1'),
    )
    const { DELETE } = await import('@/app/api/v1/listings/[id]/route')

    const response = await DELETE(deleteRequest('the-cookie'), ctx())

    expect(response.status).toBe(404)
  })

  it('maps ForbiddenError to 403', async () => {
    getCurrentUser.execute.mockResolvedValue({
      user: { id: 'user-1', role: 'user' },
      identity: {},
      reissue: false,
    })
    deleteListing.execute.mockRejectedValue(new ForbiddenError())
    const { DELETE } = await import('@/app/api/v1/listings/[id]/route')

    const response = await DELETE(deleteRequest('the-cookie'), ctx())

    expect(response.status).toBe(403)
  })

  it('maps ListingNotDeletableError to 409', async () => {
    getCurrentUser.execute.mockResolvedValue({
      user: { id: 'user-1', role: 'owner' },
      identity: {},
      reissue: false,
    })
    deleteListing.execute.mockRejectedValue(
      new ListingNotDeletableError('published'),
    )
    const { DELETE } = await import('@/app/api/v1/listings/[id]/route')

    const response = await DELETE(deleteRequest('the-cookie'), ctx())

    expect(response.status).toBe(409)
    const body = await response.json()
    expect(body.error.code).toBe('listing_not_deletable')
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
    deleteListing.execute.mockRejectedValue(new Error('boom'))
    const { DELETE } = await import('@/app/api/v1/listings/[id]/route')

    const response = await DELETE(deleteRequest('the-cookie'), ctx())

    expect(response.status).toBe(500)
    consoleError.mockRestore()
  })
})
