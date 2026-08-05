/**
 * planImageVariants — pure decision of which (width, format) pairs
 * services/images/process-image.ts should render for a given original
 * image width (PRD §8.7: "400w thumb, 800w card, 1600w hero in AVIF and
 * WebP"). Separated from the sharp pipeline itself so the planning logic
 * is unit-testable without decoding a real image.
 *
 * Never upscales: a width larger than the original is dropped rather than
 * stretching a smaller image up, which would both look poor and produce a
 * variant file no smaller than serving the original. If the original is
 * narrower than every planned width, a single pair sized to the original
 * width itself is produced instead — every listing still gets a WebP/AVIF
 * pair, just without the larger, meaningless upscaled variants.
 */

import type { ImageVariantFormat } from './image-storage-path'

const VARIANT_WIDTHS: readonly number[] = [400, 800, 1600]
const VARIANT_FORMATS: readonly ImageVariantFormat[] = ['webp', 'avif']

export interface ImageVariantPlanEntry {
  width: number
  format: ImageVariantFormat
}

export function planImageVariants(
  originalWidth: number,
): ImageVariantPlanEntry[] {
  if (originalWidth <= 0) {
    throw new Error('originalWidth must be a positive number of pixels')
  }

  const widths = VARIANT_WIDTHS.filter((width) => width <= originalWidth)
  const effectiveWidths = widths.length > 0 ? widths : [originalWidth]

  return effectiveWidths.flatMap((width) =>
    VARIANT_FORMATS.map((format) => ({ width, format })),
  )
}
