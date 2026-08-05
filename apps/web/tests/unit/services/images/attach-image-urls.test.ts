import { afterEach, describe, expect, it } from 'vitest'

import type { PropertyImage } from '@/ports/property-image-repository'
import { attachImageUrls } from '@/services/images/attach-image-urls'

import { InMemoryImageStorage } from '../../../support/in-memory-image-storage'

function image(overrides: Partial<PropertyImage> = {}): PropertyImage {
  return {
    id: 'img-1',
    propertyId: 'listing-1',
    kind: 'photo',
    storagePath: 'listings/listing-1/original/img-1',
    position: 0,
    width: 1200,
    height: 800,
    blurhash: 'LGF5?xYk^6#M@-5c,1J5@[or[Q6.',
    altText: null,
    createdAt: new Date('2026-01-01T00:00:00Z'),
    updatedAt: new Date('2026-01-01T00:00:00Z'),
    ...overrides,
  }
}

const storages: InMemoryImageStorage[] = []

afterEach(async () => {
  await Promise.all(storages.map((storage) => storage.close()))
  storages.length = 0
})

function makeStorage(): InMemoryImageStorage {
  const storage = new InMemoryImageStorage()
  storages.push(storage)
  return storage
}

// PRD §8.7 point 3 — variant paths are the only ones ever served publicly.
describe('attachImageUrls', () => {
  it('asks ImageStorage for a public URL of every planned variant, and only those', async () => {
    const storage = makeStorage()
    // 1200px wide plans the 400/800 pair in both formats (1600 dropped as
    // wider than the original) — put every one so publicUrl() has
    // something to read.
    for (const width of [400, 800]) {
      for (const format of ['webp', 'avif'] as const) {
        await storage.put(
          `listings/listing-1/variants/img-1/${width}.${format}`,
          new Uint8Array([1]),
          `image/${format}`,
        )
      }
    }

    const result = await attachImageUrls(image({ width: 1200 }), storage)

    expect(result.id).toBe('img-1')
    expect(result.urls).toHaveLength(4)
    expect(result.urls).toContainEqual({
      width: 800,
      format: 'webp',
      url: await storage.publicUrl(
        'listings/listing-1/variants/img-1/800.webp',
      ),
    })
  })

  it('never upscales: a narrow original only asks for the widths that were actually planned', async () => {
    const storage = makeStorage()
    await storage.put(
      'listings/listing-1/variants/img-tiny/200.webp',
      new Uint8Array([1]),
      'image/webp',
    )
    await storage.put(
      'listings/listing-1/variants/img-tiny/200.avif',
      new Uint8Array([1]),
      'image/avif',
    )

    const result = await attachImageUrls(
      image({ id: 'img-tiny', width: 200 }),
      storage,
    )

    expect(result.urls).toHaveLength(2)
    expect(result.urls.map((u) => u.width)).toEqual([200, 200])
  })

  it('preserves every field of the original image alongside the new urls array', async () => {
    const storage = makeStorage()
    await storage.put(
      'listings/listing-1/variants/img-1/400.webp',
      new Uint8Array([1]),
      'image/webp',
    )
    await storage.put(
      'listings/listing-1/variants/img-1/400.avif',
      new Uint8Array([1]),
      'image/avif',
    )
    const source = image({ width: 400, kind: 'epc' })

    const result = await attachImageUrls(source, storage)

    expect(result).toMatchObject(source)
  })
})
