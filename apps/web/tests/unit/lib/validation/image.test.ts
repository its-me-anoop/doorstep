import { describe, expect, it } from 'vitest'

import {
  requestImageUploadSchema,
  updateImageSchema,
} from '@/lib/validation/image'

// PRD §6.5 LST-3 — "Upload up to 25 images (15 MB each)".
describe('requestImageUploadSchema', () => {
  it('accepts an allowed content type and a size within the limit', () => {
    const result = requestImageUploadSchema.safeParse({
      contentType: 'image/jpeg',
      bytes: 1024,
    })
    expect(result.success).toBe(true)
  })

  it.each(['image/jpeg', 'image/png', 'image/webp', 'image/heic'])(
    'accepts %s',
    (contentType) => {
      expect(
        requestImageUploadSchema.safeParse({ contentType, bytes: 1024 })
          .success,
      ).toBe(true)
    },
  )

  it('rejects an unsupported content type', () => {
    const result = requestImageUploadSchema.safeParse({
      contentType: 'image/gif',
      bytes: 1024,
    })
    expect(result.success).toBe(false)
  })

  it('rejects a declared size over 15 MB', () => {
    const result = requestImageUploadSchema.safeParse({
      contentType: 'image/jpeg',
      bytes: 15 * 1024 * 1024 + 1,
    })
    expect(result.success).toBe(false)
  })

  it('accepts a declared size of exactly 15 MB', () => {
    const result = requestImageUploadSchema.safeParse({
      contentType: 'image/jpeg',
      bytes: 15 * 1024 * 1024,
    })
    expect(result.success).toBe(true)
  })

  it('rejects a non-positive declared size', () => {
    expect(
      requestImageUploadSchema.safeParse({
        contentType: 'image/jpeg',
        bytes: 0,
      }).success,
    ).toBe(false)
    expect(
      requestImageUploadSchema.safeParse({
        contentType: 'image/jpeg',
        bytes: -1,
      }).success,
    ).toBe(false)
  })
})

describe('updateImageSchema', () => {
  it('accepts position only', () => {
    expect(updateImageSchema.safeParse({ position: 2 }).success).toBe(true)
  })

  it('accepts kind only', () => {
    expect(updateImageSchema.safeParse({ kind: 'floorplan' }).success).toBe(
      true,
    )
  })

  it('accepts both position and kind', () => {
    expect(
      updateImageSchema.safeParse({ position: 1, kind: 'epc' }).success,
    ).toBe(true)
  })

  it('rejects an empty body (neither field present)', () => {
    expect(updateImageSchema.safeParse({}).success).toBe(false)
  })

  it('rejects a negative position', () => {
    expect(updateImageSchema.safeParse({ position: -1 }).success).toBe(false)
  })

  it('rejects an invalid kind', () => {
    expect(updateImageSchema.safeParse({ kind: 'panorama' }).success).toBe(
      false,
    )
  })
})
