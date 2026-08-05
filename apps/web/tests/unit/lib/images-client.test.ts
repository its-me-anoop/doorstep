import { afterEach, describe, expect, it, vi } from 'vitest'

import {
  deleteListingImage,
  ImagesApiError,
  listListingImages,
  processListingImage,
  requestImageUpload,
  setListingImageKind,
  setListingImagePosition,
  uploadOriginalBytes,
} from '@/lib/images-client'

function jsonResponse(body: unknown, status = 200): Response {
  return {
    ok: status >= 200 && status < 300,
    status,
    json: () => Promise.resolve(body),
  } as Response
}

describe('lib/images-client', () => {
  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('requestImageUpload POSTs {contentType, bytes} and returns {imageId, uploadUrl, path, headers}', async () => {
    const result = {
      imageId: 'img-1',
      uploadUrl: 'https://storage.example/signed',
      path: 'listings/listing-1/original/img-1',
      headers: { 'Content-Type': 'image/jpeg' },
    }
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse({ data: result }))
    vi.stubGlobal('fetch', fetchMock)

    const response = await requestImageUpload('listing-1', {
      contentType: 'image/jpeg',
      bytes: 1024,
    })

    expect(fetchMock).toHaveBeenCalledWith(
      '/api/v1/listings/listing-1/images',
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ contentType: 'image/jpeg', bytes: 1024 }),
      },
    )
    expect(response).toEqual(result)
  })

  it('listListingImages GETs /api/v1/listings/{id}/images and returns the images array', async () => {
    const images = [{ id: 'img-1', position: 0 }]
    const fetchMock = vi
      .fn()
      .mockResolvedValue(jsonResponse({ data: { images } }))
    vi.stubGlobal('fetch', fetchMock)

    const result = await listListingImages('listing-1')

    expect(fetchMock).toHaveBeenCalledWith(
      '/api/v1/listings/listing-1/images',
      undefined,
    )
    expect(result).toEqual(images)
  })

  it('processListingImage POSTs .../images/{imageId}/process with no body', async () => {
    const image = { id: 'img-1', width: 800 }
    const fetchMock = vi
      .fn()
      .mockResolvedValue(jsonResponse({ data: { image } }))
    vi.stubGlobal('fetch', fetchMock)

    const result = await processListingImage('listing-1', 'img-1')

    expect(fetchMock).toHaveBeenCalledWith(
      '/api/v1/listings/listing-1/images/img-1/process',
      { method: 'POST' },
    )
    expect(result).toEqual(image)
  })

  it('setListingImagePosition PATCHes {position}', async () => {
    const image = { id: 'img-1', position: 2 }
    const fetchMock = vi
      .fn()
      .mockResolvedValue(jsonResponse({ data: { image } }))
    vi.stubGlobal('fetch', fetchMock)

    const result = await setListingImagePosition('listing-1', 'img-1', 2)

    expect(fetchMock).toHaveBeenCalledWith(
      '/api/v1/listings/listing-1/images/img-1',
      {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ position: 2 }),
      },
    )
    expect(result).toEqual(image)
  })

  it('setListingImageKind PATCHes {kind}', async () => {
    const image = { id: 'img-1', kind: 'floorplan' }
    const fetchMock = vi
      .fn()
      .mockResolvedValue(jsonResponse({ data: { image } }))
    vi.stubGlobal('fetch', fetchMock)

    const result = await setListingImageKind('listing-1', 'img-1', 'floorplan')

    expect(fetchMock).toHaveBeenCalledWith(
      '/api/v1/listings/listing-1/images/img-1',
      {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ kind: 'floorplan' }),
      },
    )
    expect(result).toEqual(image)
  })

  it('deleteListingImage DELETEs the image', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValue(jsonResponse({ data: { deleted: true } }))
    vi.stubGlobal('fetch', fetchMock)

    await deleteListingImage('listing-1', 'img-1')

    expect(fetchMock).toHaveBeenCalledWith(
      '/api/v1/listings/listing-1/images/img-1',
      { method: 'DELETE' },
    )
  })

  it('throws an ImagesApiError carrying the server-supplied message on a non-OK response', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValue(
        jsonResponse(
          { error: { code: 'too_many_images', message: 'Too many photos.' } },
          409,
        ),
      )
    vi.stubGlobal('fetch', fetchMock)

    await expect(listListingImages('listing-1')).rejects.toMatchObject({
      code: 'too_many_images',
      message: 'Too many photos.',
    })
    await expect(listListingImages('listing-1')).rejects.toBeInstanceOf(
      ImagesApiError,
    )
  })

  it('falls back to a generic message when the error envelope has none', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValue(
        jsonResponse({ error: { code: 'internal_error' } }, 500),
      )
    vi.stubGlobal('fetch', fetchMock)

    await expect(listListingImages('listing-1')).rejects.toMatchObject({
      code: 'internal_error',
      message: 'Something went wrong on our end — try again in a moment.',
    })
  })

  describe('uploadOriginalBytes', () => {
    class FakeXhrUpload {
      listeners: Record<string, (event: unknown) => void> = {}
      onprogress:
        | ((event: {
            lengthComputable: boolean
            loaded: number
            total: number
          }) => void)
        | null = null
      addEventListener(type: string, listener: (event: unknown) => void) {
        this.listeners[type] = listener
      }
    }

    class FakeXhr {
      static instances: FakeXhr[] = []
      upload = new FakeXhrUpload()
      status = 200
      method = ''
      url = ''
      headers: Record<string, string> = {}
      body: unknown
      onload: (() => void) | null = null
      onerror: (() => void) | null = null

      constructor() {
        FakeXhr.instances.push(this)
      }

      open(method: string, url: string) {
        this.method = method
        this.url = url
      }

      setRequestHeader(key: string, value: string) {
        this.headers[key] = value
      }

      send(body: unknown) {
        this.body = body
      }
    }

    afterEach(() => {
      FakeXhr.instances = []
    })

    it('PUTs the file to the signed URL with the required headers', async () => {
      vi.stubGlobal('XMLHttpRequest', FakeXhr)
      const file = new File(['bytes'], 'photo.jpg', { type: 'image/jpeg' })

      const promise = uploadOriginalBytes(
        'https://storage.example/signed',
        file,
        { headers: { 'Content-Type': 'image/jpeg' } },
      )
      const xhr = FakeXhr.instances[0]!
      xhr.status = 200
      xhr.onload?.()

      await expect(promise).resolves.toBeUndefined()
      expect(xhr.method).toBe('PUT')
      expect(xhr.url).toBe('https://storage.example/signed')
      expect(xhr.headers).toEqual({ 'Content-Type': 'image/jpeg' })
      expect(xhr.body).toBe(file)
    })

    it('reports fractional progress via onProgress as upload.progress events fire', async () => {
      vi.stubGlobal('XMLHttpRequest', FakeXhr)
      const file = new File(['bytes'], 'photo.jpg', { type: 'image/jpeg' })
      const onProgress = vi.fn()

      const promise = uploadOriginalBytes(
        'https://storage.example/signed',
        file,
        {
          onProgress,
        },
      )
      const xhr = FakeXhr.instances[0]!
      xhr.upload.onprogress?.({
        lengthComputable: true,
        loaded: 50,
        total: 200,
      })
      xhr.status = 200
      xhr.onload?.()
      await promise

      expect(onProgress).toHaveBeenCalledWith(0.25)
    })

    it('rejects when the upload responds with a non-2xx status', async () => {
      vi.stubGlobal('XMLHttpRequest', FakeXhr)
      const file = new File(['bytes'], 'photo.jpg', { type: 'image/jpeg' })

      const promise = uploadOriginalBytes(
        'https://storage.example/signed',
        file,
      )
      const xhr = FakeXhr.instances[0]!
      xhr.status = 403
      xhr.onload?.()

      await expect(promise).rejects.toThrow()
    })

    it('rejects on a network error', async () => {
      vi.stubGlobal('XMLHttpRequest', FakeXhr)
      const file = new File(['bytes'], 'photo.jpg', { type: 'image/jpeg' })

      const promise = uploadOriginalBytes(
        'https://storage.example/signed',
        file,
      )
      const xhr = FakeXhr.instances[0]!
      xhr.onerror?.()

      await expect(promise).rejects.toThrow()
    })
  })
})
