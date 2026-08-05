import { describe, expect, it } from 'vitest'

import {
  originalImagePath,
  variantImagePath,
} from '@/domain/image-storage-path'

// PRD §8.7 — originals under listings/{propertyId}/original/, variants
// under listings/{propertyId}/variants/{imageId}/{width}.{format}.
describe('image-storage-path', () => {
  it('builds the original upload path from propertyId and imageId', () => {
    expect(originalImagePath('prop-1', 'img-1')).toBe(
      'listings/prop-1/original/img-1',
    )
  })

  it('builds a variant path from propertyId, imageId, width and format', () => {
    expect(variantImagePath('prop-1', 'img-1', 800, 'webp')).toBe(
      'listings/prop-1/variants/img-1/800.webp',
    )
    expect(variantImagePath('prop-1', 'img-1', 1600, 'avif')).toBe(
      'listings/prop-1/variants/img-1/1600.avif',
    )
  })
})
