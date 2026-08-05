import { describe, expect, it } from 'vitest'

import { planImageVariants } from '@/domain/image-variant-plan'

// PRD §8.7 — "generates variants with sharp: 400w thumb, 800w card, 1600w
// hero in AVIF and WebP". planImageVariants is the pure decision of which
// (width, format) pairs to generate for a given original width — kept
// separate from the sharp pipeline itself (services/images/process-image.ts)
// so the decision is unit-testable without decoding a real image.
describe('planImageVariants', () => {
  it('plans all three widths in both formats for a large original', () => {
    const plan = planImageVariants(2400)

    const widths = [...new Set(plan.map((entry) => entry.width))]
    expect(widths).toEqual([400, 800, 1600])
    expect(plan).toHaveLength(6)
    expect(plan).toEqual(
      expect.arrayContaining([
        { width: 400, format: 'webp' },
        { width: 400, format: 'avif' },
        { width: 800, format: 'webp' },
        { width: 800, format: 'avif' },
        { width: 1600, format: 'webp' },
        { width: 1600, format: 'avif' },
      ]),
    )
  })

  it('never upscales: drops widths larger than the original', () => {
    const plan = planImageVariants(900)

    const widths = [...new Set(plan.map((entry) => entry.width))]
    expect(widths).toEqual([400, 800])
  })

  it('falls back to the original width alone when smaller than the smallest variant', () => {
    const plan = planImageVariants(250)

    const widths = [...new Set(plan.map((entry) => entry.width))]
    expect(widths).toEqual([250])
    expect(plan).toHaveLength(2) // still both formats
  })

  it('clamps to the original width exactly when it matches a planned width', () => {
    const plan = planImageVariants(400)

    const widths = [...new Set(plan.map((entry) => entry.width))]
    expect(widths).toEqual([400])
  })

  it('rejects a non-positive width', () => {
    expect(() => planImageVariants(0)).toThrow(/positive/i)
    expect(() => planImageVariants(-10)).toThrow(/positive/i)
  })
})
