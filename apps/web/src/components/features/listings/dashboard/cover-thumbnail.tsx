import { Camera } from 'lucide-react'

import { blurhashAverageColor } from '@/lib/blurhash-preview'

interface CoverThumbnailProps {
  /** The listing's position-0 image blurhash (services/images/
   * get-cover-blurhashes.ts), or `null` when the listing has no images
   * yet. */
  blurhash: string | null
}

/**
 * CoverThumbnail — the my-listings dashboard row's 96px cover tile
 * (M1-DESIGN-SPEC.md §4.2 point 1). Reuses `blurhashAverageColor` (the
 * same average-colour placeholder the wizard's photo grid already
 * renders behind every tile, lib/blurhash-preview.ts) rather than
 * resolving the crisp photo URL here — see
 * services/images/get-cover-blurhashes.ts's doc comment for why the
 * crisp image is a tracked follow-up, not this component's job. A
 * listing with no images at all falls back to the spec's flat
 * `--paper-200` tile with a centred camera glyph, exactly as specified
 * for a photo-less draft.
 */
export function CoverThumbnail({ blurhash }: CoverThumbnailProps) {
  if (!blurhash) {
    return (
      <div
        aria-label="No photo yet"
        className="bg-secondary flex aspect-[4/3] w-24 shrink-0 items-center justify-center rounded-[var(--radius-sm)]"
      >
        <Camera aria-hidden="true" className="text-muted-foreground size-5" />
      </div>
    )
  }

  return (
    <div
      data-testid="cover-thumbnail"
      role="img"
      aria-label="Cover photo"
      className="aspect-[4/3] w-24 shrink-0 rounded-[var(--radius-sm)]"
      style={{ backgroundColor: blurhashAverageColor(blurhash) }}
    />
  )
}
