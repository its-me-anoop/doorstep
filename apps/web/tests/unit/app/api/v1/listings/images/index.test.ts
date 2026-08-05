import { NextRequest } from 'next/server'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { SESSION_COOKIE_NAME } from '@/lib/session-cookie-name'
import { ListingNotFoundError } from '@/ports/listing-repository'
import { ForbiddenError } from '@/services/authz'
import { TooManyImagesError } from '@/services/images'

const getCurrentUser = { execute: vi.fn() }
const requestImageUpload = { execute: vi.fn() }

vi.mock('@/lib/composition', () => ({
  createServices: () => ({
    auth: { getCurrentUser },
    images: { requestImageUpload },
  }),
}))

function postRequest(body: unknown, cookie?: string): NextRequest {
  const headers = new Headers({ 'Content-Type': 'application/json' })
  if (cookie) headers.set('cookie', `${SESSION_COOKIE_NAME}=${cookie}`)
  return new NextRequest(
    'https://doorstep.test/api/v1/listings/listing-1/images',
    { method: 'POST', headers, body: JSON.stringify(body) },
  )
}

function ctx(id = 'listing-1') {
  return { params: Promise.resolve({ id }) }
}

describe('POST /api/v1/listings/[id]/images', () => {
  beforeEach(() => {
    getCurrentUser.execute.mockReset()
    requestImageUpload.execute.mockReset()
  })

  it('401s with no session cookie, without touching the body', async () => {
    const { POST } = await import('@/app/api/v1/listings/[id]/images/route')

    const response = await POST(
      postRequest({ contentType: 'image/jpeg', bytes: 1024 }),
      ctx(),
    )

    expect(response.status).toBe(401)
    expect(requestImageUpload.execute).not.toHaveBeenCalled()
  })

  it('400s when the body fails validation', async () => {
    const { POST } = await import('@/app/api/v1/listings/[id]/images/route')

    const response = await POST(
      postRequest({ contentType: 'image/gif', bytes: 1024 }, 'the-cookie'),
      ctx(),
    )

    expect(response.status).toBe(400)
    expect(requestImageUpload.execute).not.toHaveBeenCalled()
  })

  it('returns {data: {imageId, uploadUrl, path}} on success', async () => {
    const actor = { id: 'user-1', role: 'owner' }
    const result = {
      imageId: 'img-1',
      uploadUrl: 'https://storage.example/signed',
      path: 'listings/listing-1/original/img-1',
      headers: { 'Content-Type': 'image/jpeg' },
    }
    getCurrentUser.execute.mockResolvedValue({
      user: actor,
      identity: {},
      reissue: false,
    })
    requestImageUpload.execute.mockResolvedValue(result)
    const { POST } = await import('@/app/api/v1/listings/[id]/images/route')

    const response = await POST(
      postRequest({ contentType: 'image/jpeg', bytes: 1024 }, 'the-cookie'),
      ctx('listing-1'),
    )

    expect(requestImageUpload.execute).toHaveBeenCalledWith(
      actor,
      'listing-1',
      { contentType: 'image/jpeg', bytes: 1024 },
    )
    expect(response.status).toBe(200)
    const body = await response.json()
    expect(body.data).toEqual(result)
  })

  it('maps ListingNotFoundError to 404', async () => {
    getCurrentUser.execute.mockResolvedValue({
      user: { id: 'user-1', role: 'owner' },
      identity: {},
      reissue: false,
    })
    requestImageUpload.execute.mockRejectedValue(
      new ListingNotFoundError('listing-1'),
    )
    const { POST } = await import('@/app/api/v1/listings/[id]/images/route')

    const response = await POST(
      postRequest({ contentType: 'image/jpeg', bytes: 1024 }, 'the-cookie'),
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
    requestImageUpload.execute.mockRejectedValue(new ForbiddenError())
    const { POST } = await import('@/app/api/v1/listings/[id]/images/route')

    const response = await POST(
      postRequest({ contentType: 'image/jpeg', bytes: 1024 }, 'the-cookie'),
      ctx(),
    )

    expect(response.status).toBe(403)
  })

  it('maps TooManyImagesError to 409', async () => {
    getCurrentUser.execute.mockResolvedValue({
      user: { id: 'user-1', role: 'owner' },
      identity: {},
      reissue: false,
    })
    requestImageUpload.execute.mockRejectedValue(new TooManyImagesError(25))
    const { POST } = await import('@/app/api/v1/listings/[id]/images/route')

    const response = await POST(
      postRequest({ contentType: 'image/jpeg', bytes: 1024 }, 'the-cookie'),
      ctx(),
    )

    expect(response.status).toBe(409)
    const body = await response.json()
    expect(body.error.code).toBe('too_many_images')
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
    requestImageUpload.execute.mockRejectedValue(new Error('boom'))
    const { POST } = await import('@/app/api/v1/listings/[id]/images/route')

    const response = await POST(
      postRequest({ contentType: 'image/jpeg', bytes: 1024 }, 'the-cookie'),
      ctx(),
    )

    expect(response.status).toBe(500)
    consoleError.mockRestore()
  })
})
