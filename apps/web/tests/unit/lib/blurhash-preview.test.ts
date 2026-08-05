import { decode } from 'blurhash'
import { describe, expect, it } from 'vitest'

import { blurhashAverageColor } from '@/lib/blurhash-preview'

// A real, valid hash (reused from services/images test fixtures).
const SAMPLE_HASH = 'LGF5?xYk^6#M@-5c,1J5@[or[Q6.'

describe('blurhashAverageColor', () => {
  it('decodes to the same rgb triple the blurhash package itself decodes at 1x1', () => {
    const [r, g, b] = decode(SAMPLE_HASH, 1, 1)

    expect(blurhashAverageColor(SAMPLE_HASH)).toBe(`rgb(${r} ${g} ${b})`)
  })

  it('returns a css rgb() string with three 0-255 channel values', () => {
    const result = blurhashAverageColor(SAMPLE_HASH)
    const match = /^rgb\((\d+) (\d+) (\d+)\)$/.exec(result)

    expect(match).not.toBeNull()
    for (const channel of match!.slice(1)) {
      const value = Number(channel)
      expect(value).toBeGreaterThanOrEqual(0)
      expect(value).toBeLessThanOrEqual(255)
    }
  })

  it('is deterministic for the same hash', () => {
    expect(blurhashAverageColor(SAMPLE_HASH)).toBe(
      blurhashAverageColor(SAMPLE_HASH),
    )
  })
})
