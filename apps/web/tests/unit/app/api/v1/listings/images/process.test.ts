import { NextRequest } from 'next/server'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { SESSION_COOKIE_NAME } from '@/lib/session-cookie-name'
import { ListingNotFoundError } from '@/ports/listing-repository'
import { ForbiddenError } from '@/services/authz'
import { OriginalImageNotFoundError } from '@/services/images'

const getCurrentUser = { execute: vi.fn() }
const processImage = { execute: vi.fn() }

vi.mock('@/lib/composition', () => ({
  createServices: () => ({
    auth: { getCurrentUser },
    images: { processImage },
  }),
}))

function postRequest(cookie?: string): NextRequest {
  const headers = new Headers()
  if (cookie) headers.set('cookie', `${SESSION_COOKIE_NAME}=${cookie}`)
  return new NextRequest(
    'https://doorstep.test/api/v1/listings/listing-1/images/img-1/process',
    { method: 'POST', headers },
  )
}

function ctx(id = 'listing-1', imageId = 'img-1') {
  return { params: Promise.resolve({ id, imageId }) }
}

describe('POST /api/v1/listings/[id]/images/[imageId]/process', () => {
  beforeEach(() => {
    getCurrentUser.execute.mockReset()
    processImage.execute.mockReset()
  })

  it('401s with no session cookie', async () => {
    const { POST } =
      await import('@/app/api/v1/listings/[id]/images/[imageId]/process/route')

    const response = await POST(postRequest(), ctx())

    expect(response.status).toBe(401)
    expect(processImage.execute).not.toHaveBeenCalled()
  })

  it('processes and returns {data: {image}} on success', async () => {
    const actor = { id: 'user-1', role: 'owner' }
    const image = { id: 'img-1', width: 800, height: 600 }
    getCurrentUser.execute.mockResolvedValue({
      user: actor,
      identity: {},
      reissue: false,
    })
    processImage.execute.mockResolvedValue(image)
    const { POST } =
      await import('@/app/api/v1/listings/[id]/images/[imageId]/process/route')

    const response = await POST(
      postRequest('the-cookie'),
      ctx('listing-1', 'img-1'),
    )

    expect(processImage.execute).toHaveBeenCalledWith(
      actor,
      'listing-1',
      'img-1',
    )
    expect(response.status).toBe(200)
    const body = await response.json()
    expect(body.data.image).toEqual(image)
  })

  it('maps ListingNotFoundError to 404', async () => {
    getCurrentUser.execute.mockResolvedValue({
      user: { id: 'user-1', role: 'owner' },
      identity: {},
      reissue: false,
    })
    processImage.execute.mockRejectedValue(
      new ListingNotFoundError('listing-1'),
    )
    const { POST } =
      await import('@/app/api/v1/listings/[id]/images/[imageId]/process/route')

    const response = await POST(postRequest('the-cookie'), ctx())

    expect(response.status).toBe(404)
  })

  it('maps ForbiddenError to 403', async () => {
    getCurrentUser.execute.mockResolvedValue({
      user: { id: 'user-1', role: 'user' },
      identity: {},
      reissue: false,
    })
    processImage.execute.mockRejectedValue(new ForbiddenError())
    const { POST } =
      await import('@/app/api/v1/listings/[id]/images/[imageId]/process/route')

    const response = await POST(postRequest('the-cookie'), ctx())

    expect(response.status).toBe(403)
  })

  it('maps OriginalImageNotFoundError to 404', async () => {
    getCurrentUser.execute.mockResolvedValue({
      user: { id: 'user-1', role: 'owner' },
      identity: {},
      reissue: false,
    })
    processImage.execute.mockRejectedValue(
      new OriginalImageNotFoundError('img-1'),
    )
    const { POST } =
      await import('@/app/api/v1/listings/[id]/images/[imageId]/process/route')

    const response = await POST(postRequest('the-cookie'), ctx())

    expect(response.status).toBe(404)
    const body = await response.json()
    expect(body.error.code).toBe('original_not_found')
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
    processImage.execute.mockRejectedValue(new Error('boom'))
    const { POST } =
      await import('@/app/api/v1/listings/[id]/images/[imageId]/process/route')

    const response = await POST(postRequest('the-cookie'), ctx())

    expect(response.status).toBe(500)
    consoleError.mockRestore()
  })
})
