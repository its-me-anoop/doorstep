import { NextRequest } from 'next/server'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { SESSION_COOKIE_NAME } from '@/lib/session-cookie-name'
import { ListingNotFoundError } from '@/ports/listing-repository'
import { PropertyImageNotFoundError } from '@/ports/property-image-repository'
import { ForbiddenError } from '@/services/authz'

const getCurrentUser = { execute: vi.fn() }
const reorderImages = { execute: vi.fn() }
const setImageKind = { execute: vi.fn() }
const deleteImage = { execute: vi.fn() }

vi.mock('@/lib/composition', () => ({
  createServices: () => ({
    auth: { getCurrentUser },
    images: { reorderImages, setImageKind, deleteImage },
  }),
}))

function patchRequest(body: unknown, cookie?: string): NextRequest {
  const headers = new Headers({ 'Content-Type': 'application/json' })
  if (cookie) headers.set('cookie', `${SESSION_COOKIE_NAME}=${cookie}`)
  return new NextRequest(
    'https://doorstep.test/api/v1/listings/listing-1/images/img-1',
    { method: 'PATCH', headers, body: JSON.stringify(body) },
  )
}

function deleteRequest(cookie?: string): NextRequest {
  const headers = new Headers()
  if (cookie) headers.set('cookie', `${SESSION_COOKIE_NAME}=${cookie}`)
  return new NextRequest(
    'https://doorstep.test/api/v1/listings/listing-1/images/img-1',
    { method: 'DELETE', headers },
  )
}

function ctx(id = 'listing-1', imageId = 'img-1') {
  return { params: Promise.resolve({ id, imageId }) }
}

describe('PATCH /api/v1/listings/[id]/images/[imageId]', () => {
  beforeEach(() => {
    getCurrentUser.execute.mockReset()
    reorderImages.execute.mockReset()
    setImageKind.execute.mockReset()
  })

  it('401s with no session cookie, without touching the body', async () => {
    const { PATCH } =
      await import('@/app/api/v1/listings/[id]/images/[imageId]/route')

    const response = await PATCH(patchRequest({ position: 1 }), ctx())

    expect(response.status).toBe(401)
    expect(reorderImages.execute).not.toHaveBeenCalled()
  })

  it('400s when the body fails validation (neither field present)', async () => {
    const { PATCH } =
      await import('@/app/api/v1/listings/[id]/images/[imageId]/route')

    const response = await PATCH(patchRequest({}, 'the-cookie'), ctx())

    expect(response.status).toBe(400)
  })

  it('calls reorderImages when position is present', async () => {
    const actor = { id: 'user-1', role: 'owner' }
    const image = { id: 'img-1', position: 2 }
    getCurrentUser.execute.mockResolvedValue({
      user: actor,
      identity: {},
      reissue: false,
    })
    reorderImages.execute.mockResolvedValue(image)
    const { PATCH } =
      await import('@/app/api/v1/listings/[id]/images/[imageId]/route')

    const response = await PATCH(
      patchRequest({ position: 2 }, 'the-cookie'),
      ctx('listing-1', 'img-1'),
    )

    expect(reorderImages.execute).toHaveBeenCalledWith(
      actor,
      'listing-1',
      'img-1',
      2,
    )
    expect(setImageKind.execute).not.toHaveBeenCalled()
    expect(response.status).toBe(200)
    const body = await response.json()
    expect(body.data.image).toEqual(image)
  })

  it('calls setImageKind when kind is present', async () => {
    const actor = { id: 'user-1', role: 'owner' }
    const image = { id: 'img-1', kind: 'floorplan' }
    getCurrentUser.execute.mockResolvedValue({
      user: actor,
      identity: {},
      reissue: false,
    })
    setImageKind.execute.mockResolvedValue(image)
    const { PATCH } =
      await import('@/app/api/v1/listings/[id]/images/[imageId]/route')

    const response = await PATCH(
      patchRequest({ kind: 'floorplan' }, 'the-cookie'),
      ctx('listing-1', 'img-1'),
    )

    expect(setImageKind.execute).toHaveBeenCalledWith(
      actor,
      'listing-1',
      'img-1',
      'floorplan',
    )
    expect(reorderImages.execute).not.toHaveBeenCalled()
    expect(response.status).toBe(200)
    const body = await response.json()
    expect(body.data.image).toEqual(image)
  })

  it('calls both when position and kind are both present, returning the final state', async () => {
    const actor = { id: 'user-1', role: 'owner' }
    reorderImages.execute.mockResolvedValue({
      id: 'img-1',
      position: 1,
      kind: 'photo',
    })
    const finalImage = { id: 'img-1', position: 1, kind: 'epc' }
    setImageKind.execute.mockResolvedValue(finalImage)
    getCurrentUser.execute.mockResolvedValue({
      user: actor,
      identity: {},
      reissue: false,
    })
    const { PATCH } =
      await import('@/app/api/v1/listings/[id]/images/[imageId]/route')

    const response = await PATCH(
      patchRequest({ position: 1, kind: 'epc' }, 'the-cookie'),
      ctx('listing-1', 'img-1'),
    )

    expect(reorderImages.execute).toHaveBeenCalled()
    expect(setImageKind.execute).toHaveBeenCalled()
    const body = await response.json()
    expect(body.data.image).toEqual(finalImage)
  })

  it('maps PropertyImageNotFoundError to 404', async () => {
    getCurrentUser.execute.mockResolvedValue({
      user: { id: 'user-1', role: 'owner' },
      identity: {},
      reissue: false,
    })
    reorderImages.execute.mockRejectedValue(
      new PropertyImageNotFoundError('img-1'),
    )
    const { PATCH } =
      await import('@/app/api/v1/listings/[id]/images/[imageId]/route')

    const response = await PATCH(
      patchRequest({ position: 1 }, 'the-cookie'),
      ctx(),
    )

    expect(response.status).toBe(404)
  })

  it('maps ListingNotFoundError to 404', async () => {
    getCurrentUser.execute.mockResolvedValue({
      user: { id: 'user-1', role: 'owner' },
      identity: {},
      reissue: false,
    })
    reorderImages.execute.mockRejectedValue(
      new ListingNotFoundError('listing-1'),
    )
    const { PATCH } =
      await import('@/app/api/v1/listings/[id]/images/[imageId]/route')

    const response = await PATCH(
      patchRequest({ position: 1 }, 'the-cookie'),
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
    reorderImages.execute.mockRejectedValue(new ForbiddenError())
    const { PATCH } =
      await import('@/app/api/v1/listings/[id]/images/[imageId]/route')

    const response = await PATCH(
      patchRequest({ position: 1 }, 'the-cookie'),
      ctx(),
    )

    expect(response.status).toBe(403)
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
    reorderImages.execute.mockRejectedValue(new Error('boom'))
    const { PATCH } =
      await import('@/app/api/v1/listings/[id]/images/[imageId]/route')

    const response = await PATCH(
      patchRequest({ position: 1 }, 'the-cookie'),
      ctx(),
    )

    expect(response.status).toBe(500)
    consoleError.mockRestore()
  })
})

describe('DELETE /api/v1/listings/[id]/images/[imageId]', () => {
  beforeEach(() => {
    getCurrentUser.execute.mockReset()
    deleteImage.execute.mockReset()
  })

  it('401s with no session cookie', async () => {
    const { DELETE } =
      await import('@/app/api/v1/listings/[id]/images/[imageId]/route')

    const response = await DELETE(deleteRequest(), ctx())

    expect(response.status).toBe(401)
    expect(deleteImage.execute).not.toHaveBeenCalled()
  })

  it('deletes and returns {data: {deleted: true}} on success', async () => {
    const actor = { id: 'user-1', role: 'owner' }
    getCurrentUser.execute.mockResolvedValue({
      user: actor,
      identity: {},
      reissue: false,
    })
    deleteImage.execute.mockResolvedValue(undefined)
    const { DELETE } =
      await import('@/app/api/v1/listings/[id]/images/[imageId]/route')

    const response = await DELETE(
      deleteRequest('the-cookie'),
      ctx('listing-1', 'img-1'),
    )

    expect(deleteImage.execute).toHaveBeenCalledWith(
      actor,
      'listing-1',
      'img-1',
    )
    expect(response.status).toBe(200)
    const body = await response.json()
    expect(body.data).toEqual({ deleted: true })
  })

  it('maps PropertyImageNotFoundError to 404', async () => {
    getCurrentUser.execute.mockResolvedValue({
      user: { id: 'user-1', role: 'owner' },
      identity: {},
      reissue: false,
    })
    deleteImage.execute.mockRejectedValue(
      new PropertyImageNotFoundError('img-1'),
    )
    const { DELETE } =
      await import('@/app/api/v1/listings/[id]/images/[imageId]/route')

    const response = await DELETE(deleteRequest('the-cookie'), ctx())

    expect(response.status).toBe(404)
  })

  it('maps ForbiddenError to 403', async () => {
    getCurrentUser.execute.mockResolvedValue({
      user: { id: 'user-1', role: 'user' },
      identity: {},
      reissue: false,
    })
    deleteImage.execute.mockRejectedValue(new ForbiddenError())
    const { DELETE } =
      await import('@/app/api/v1/listings/[id]/images/[imageId]/route')

    const response = await DELETE(deleteRequest('the-cookie'), ctx())

    expect(response.status).toBe(403)
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
    deleteImage.execute.mockRejectedValue(new Error('boom'))
    const { DELETE } =
      await import('@/app/api/v1/listings/[id]/images/[imageId]/route')

    const response = await DELETE(deleteRequest('the-cookie'), ctx())

    expect(response.status).toBe(500)
    consoleError.mockRestore()
  })
})
