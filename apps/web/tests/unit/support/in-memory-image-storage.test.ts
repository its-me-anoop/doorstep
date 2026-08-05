import { afterEach, describe, expect, it } from 'vitest'

import { InMemoryImageStorage } from '../../support/in-memory-image-storage'

describe('InMemoryImageStorage', () => {
  let sut: InMemoryImageStorage

  afterEach(async () => {
    await sut?.close()
  })

  it('round-trips put/get/exists/delete', async () => {
    sut = new InMemoryImageStorage()
    const bytes = new Uint8Array([1, 2, 3, 4])

    expect(await sut.exists('a/b.jpg')).toBe(false)
    expect(await sut.get('a/b.jpg')).toBeNull()

    await sut.put('a/b.jpg', bytes, 'image/jpeg')

    expect(await sut.exists('a/b.jpg')).toBe(true)
    expect(await sut.get('a/b.jpg')).toEqual(bytes)

    await sut.delete('a/b.jpg')

    expect(await sut.exists('a/b.jpg')).toBe(false)
    expect(await sut.get('a/b.jpg')).toBeNull()
  })

  it('delete is a no-op for a path that was never written', async () => {
    sut = new InMemoryImageStorage()

    await expect(sut.delete('never/written.jpg')).resolves.toBeUndefined()
  })

  it('publicUrl serves exactly the stored bytes via a real fetch', async () => {
    sut = new InMemoryImageStorage()
    const bytes = new Uint8Array([10, 20, 30, 255, 0])
    await sut.put('variants/img-1/400.webp', bytes, 'image/webp')

    const url = await sut.publicUrl('variants/img-1/400.webp')
    const response = await fetch(url)
    const served = new Uint8Array(await response.arrayBuffer())

    expect(served).toEqual(bytes)
    expect(response.headers.get('content-type')).toBe('image/webp')
  })

  it('a signed upload URL accepts a PUT within constraints, and the object then exists', async () => {
    sut = new InMemoryImageStorage()
    const bytes = new Uint8Array(1024).fill(7)

    const signed = await sut.createSignedUploadUrl(
      'listings/p1/original/img-1',
      {
        contentType: 'image/jpeg',
        maxBytes: 15 * 1024 * 1024,
        expiresInMs: 60_000,
      },
    )

    expect(await sut.exists('listings/p1/original/img-1')).toBe(false)

    const putResponse = await fetch(signed.url, {
      method: 'PUT',
      headers: signed.headers,
      body: bytes,
    })

    expect(putResponse.ok).toBe(true)
    expect(await sut.exists('listings/p1/original/img-1')).toBe(true)
    expect(await sut.get('listings/p1/original/img-1')).toEqual(bytes)
  })

  it('rejects a PUT larger than maxBytes', async () => {
    sut = new InMemoryImageStorage()
    const tooBig = new Uint8Array(2048).fill(1)

    const signed = await sut.createSignedUploadUrl(
      'listings/p1/original/img-2',
      {
        contentType: 'image/jpeg',
        maxBytes: 1024,
        expiresInMs: 60_000,
      },
    )

    const putResponse = await fetch(signed.url, {
      method: 'PUT',
      headers: signed.headers,
      body: tooBig,
    })

    expect(putResponse.ok).toBe(false)
    expect(await sut.exists('listings/p1/original/img-2')).toBe(false)
  })

  it('rejects a PUT whose content-type does not match the signed contentType', async () => {
    sut = new InMemoryImageStorage()

    const signed = await sut.createSignedUploadUrl(
      'listings/p1/original/img-3',
      {
        contentType: 'image/jpeg',
        maxBytes: 1024,
        expiresInMs: 60_000,
      },
    )

    const putResponse = await fetch(signed.url, {
      method: 'PUT',
      headers: { 'Content-Type': 'image/png' },
      body: new Uint8Array([1, 2, 3]),
    })

    expect(putResponse.ok).toBe(false)
    expect(await sut.exists('listings/p1/original/img-3')).toBe(false)
  })

  it('rejects a PUT against an unknown or already-used token', async () => {
    sut = new InMemoryImageStorage()
    const signed = await sut.createSignedUploadUrl(
      'listings/p1/original/img-4',
      {
        contentType: 'image/jpeg',
        maxBytes: 1024,
        expiresInMs: 60_000,
      },
    )

    await fetch(signed.url, {
      method: 'PUT',
      headers: signed.headers,
      body: new Uint8Array([1]),
    })

    // Same token, used again.
    const secondPut = await fetch(signed.url, {
      method: 'PUT',
      headers: signed.headers,
      body: new Uint8Array([2]),
    })

    expect(secondPut.ok).toBe(false)
  })

  it('rejects a PUT against an expired token', async () => {
    sut = new InMemoryImageStorage()
    const signed = await sut.createSignedUploadUrl(
      'listings/p1/original/img-5',
      {
        contentType: 'image/jpeg',
        maxBytes: 1024,
        expiresInMs: -1,
      },
    )

    const putResponse = await fetch(signed.url, {
      method: 'PUT',
      headers: signed.headers,
      body: new Uint8Array([1]),
    })

    expect(putResponse.ok).toBe(false)
  })
})
