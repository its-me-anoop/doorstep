/**
 * computeBlurhash — wraps the 'blurhash' package's encode() with this
 * project's fixed component choice (PRD §8.7: "computes a blurhash
 * placeholder"). 4x3 (width components x height components) is a common
 * default that balances placeholder fidelity against string length for a
 * property photo's typical landscape aspect ratio.
 *
 * 'blurhash' is a small, dependency-free encoding algorithm over
 * already-decoded pixels, not an infrastructure vendor — unlike Drizzle,
 * Firebase or Next.js it has no swap-target and isn't behind a port (PRD
 * §8.5's port list has none for it), so domain/ importing it directly is
 * consistent with slug.ts and money.ts, this file's neighbours.
 */

import { encode } from 'blurhash'

const COMPONENTS_X = 4
const COMPONENTS_Y = 3

/** `pixels` must be raw RGBA (4 channels), row-major, `width * height * 4`
 * bytes — the shape sharp's `.raw().ensureAlpha()` output produces. */
export function computeBlurhash(
  pixels: Uint8ClampedArray,
  width: number,
  height: number,
): string {
  return encode(pixels, width, height, COMPONENTS_X, COMPONENTS_Y)
}
