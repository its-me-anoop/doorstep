import { describe, expect, it } from 'vitest'

import {
  ALLOWED_IMAGE_CONTENT_TYPES,
  isAllowedImageContentType,
  MAX_IMAGES_PER_LISTING,
  MAX_IMAGE_BYTES,
} from '@/domain/image-upload-policy'

// PRD §6.5 LST-3 — "Upload up to 25 images (15 MB each)".
describe('image-upload-policy', () => {
  it('caps listings at 25 images', () => {
    expect(MAX_IMAGES_PER_LISTING).toBe(25)
  })

  it('caps a single image at 15 MB', () => {
    expect(MAX_IMAGE_BYTES).toBe(15 * 1024 * 1024)
  })

  it.each(['image/jpeg', 'image/png', 'image/webp', 'image/heic'])(
    'allows %s',
    (contentType) => {
      expect(isAllowedImageContentType(contentType)).toBe(true)
    },
  )

  it.each(['image/gif', 'application/pdf', 'text/html', ''])(
    'rejects %s',
    (contentType) => {
      expect(isAllowedImageContentType(contentType)).toBe(false)
    },
  )

  it('exposes the allow-list so validation schemas can build z.enum from it', () => {
    expect(ALLOWED_IMAGE_CONTENT_TYPES).toEqual([
      'image/jpeg',
      'image/png',
      'image/webp',
      'image/heic',
    ])
  })
})
