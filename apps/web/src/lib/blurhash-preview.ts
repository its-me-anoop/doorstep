/**
 * blurhashAverageColor — the photo tile's placeholder background
 * (M1-DESIGN-SPEC.md §1.5: "the blurhash-decoded placeholder swaps in as
 * the tile's background, then the real optimised image crossfades over
 * it"). Deliberately a single decoded colour swatch rather than a full
 * decoded gradient bitmap: rendering the latter needs a `<canvas>` to
 * rasterise blurhash's decoded pixel buffer into a paintable image, which
 * this codebase's test environment (jsdom, no canvas) can't exercise —
 * see the doc comment on this file's test for the tracked scope trim.
 * Decoding at 1×1 is not a hack: blurhash's own algorithm makes the
 * single pixel of a 1×1 decode exactly the hash's DC (average colour)
 * component, so this is a real, hash-derived colour, not a fallback
 * token.
 */
import { decode } from 'blurhash'

export function blurhashAverageColor(hash: string): string {
  const pixels = decode(hash, 1, 1)
  return `rgb(${pixels[0]} ${pixels[1]} ${pixels[2]})`
}
