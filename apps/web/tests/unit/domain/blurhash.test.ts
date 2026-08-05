import { isBlurhashValid } from 'blurhash'
import { describe, expect, it } from 'vitest'

import { computeBlurhash } from '@/domain/blurhash'

function solidPixels(
  width: number,
  height: number,
  rgba: number[],
): Uint8ClampedArray {
  const pixels = new Uint8ClampedArray(width * height * 4)
  for (let i = 0; i < pixels.length; i += 4) {
    pixels.set(rgba, i)
  }
  return pixels
}

// PRD §8.7 — "computes a blurhash placeholder" (4x3 components from a 32px
// raw decode). This wraps the 'blurhash' package's encode() with this
// project's fixed 4x3 component choice so every caller (services/images/
// process-image.ts) gets the same shape without repeating the constants.
describe('computeBlurhash', () => {
  it('returns a string that the blurhash package itself considers valid', () => {
    const pixels = solidPixels(32, 32, [200, 120, 60, 255])

    const hash = computeBlurhash(pixels, 32, 32)

    expect(isBlurhashValid(hash).result).toBe(true)
  })

  it('is deterministic for the same pixels', () => {
    const pixels = solidPixels(32, 24, [10, 200, 90, 255])

    const first = computeBlurhash(pixels, 32, 24)
    const second = computeBlurhash(pixels, 32, 24)

    expect(first).toBe(second)
  })

  it('differs for different pixels', () => {
    const a = computeBlurhash(solidPixels(32, 32, [255, 0, 0, 255]), 32, 32)
    const b = computeBlurhash(solidPixels(32, 32, [0, 0, 255, 255]), 32, 32)

    expect(a).not.toBe(b)
  })

  it('uses 4x3 components, matching PRD §8.7', () => {
    const pixels = solidPixels(32, 32, [128, 128, 128, 255])

    // Per the blurhash spec, the first character encodes
    // (componentsX - 1) + (componentsY - 1) * 9 in base83.
    const hash = computeBlurhash(pixels, 32, 32)
    const sizeFlag =
      '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz#$%*+,-.:;=?@[]^_{|}~'.indexOf(
        hash[0],
      )
    const componentsX = (sizeFlag % 9) + 1
    const componentsY = Math.floor(sizeFlag / 9) + 1
    expect(componentsX).toBe(4)
    expect(componentsY).toBe(3)
  })
})
