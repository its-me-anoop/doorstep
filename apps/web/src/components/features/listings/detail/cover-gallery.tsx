'use client'

import { useState } from 'react'

import { blurhashAverageColor } from '@/lib/blurhash-preview'
import { cn } from '@/lib/utils'
import type { PublicListingImage } from '@/services/listings/get-public-listing'

interface CoverGalleryProps {
  /** Fallback alt text for an image with no `altText` of its own. */
  title: string
  /** Position-ordered (kind mixed in — photo, floorplan, epc all share
   * one strip per §5.3). */
  images: PublicListingImage[]
}

const KIND_LABEL: Partial<Record<PublicListingImage['kind'], string>> = {
  floorplan: 'Floorplan',
  epc: 'EPC certificate',
}

/** The widest available variant in `format`, or the widest variant of
 * any format if none match — used for the cover (prefers the 1600w hero
 * variant, PRD §8.7) and, with a lower preferred width, the thumbnail. */
function widestUrl(
  urls: PublicListingImage['urls'],
  format: 'webp' | 'avif' = 'webp',
): string | undefined {
  const candidates = urls.filter((url) => url.format === format)
  const pool = candidates.length > 0 ? candidates : urls
  return pool.reduce<(typeof urls)[number] | undefined>(
    (widest, url) => (!widest || url.width > widest.width ? url : widest),
    undefined,
  )?.url
}

function narrowestUrl(
  urls: PublicListingImage['urls'],
  format: 'webp' | 'avif' = 'webp',
): string | undefined {
  const candidates = urls.filter((url) => url.format === format)
  const pool = candidates.length > 0 ? candidates : urls
  return pool.reduce<(typeof urls)[number] | undefined>(
    (narrowest, url) =>
      !narrowest || url.width < narrowest.width ? url : narrowest,
    undefined,
  )?.url
}

/**
 * CoverGallery — M2-DESIGN-SPEC.md §5.3. Full-width cover
 * (`aspect-[4/3]` mobile, `aspect-[16/10]` at ≥768px) + a thumbnail strip
 * directly below; clicking/tapping a thumbnail swaps the cover slot's
 * content in place — no lightbox, no new route, no overlay (that's
 * DET-1's M4 reservation, §5.3's own note: the cover container is
 * already a discrete element with headroom for a future `Maximize2`
 * button, nothing more needs to change here to add it later).
 */
export function CoverGallery({ title, images }: CoverGalleryProps) {
  const [selectedId, setSelectedId] = useState(images[0]?.id)
  const selected = images.find((image) => image.id === selectedId) ?? images[0]

  return (
    <div className="flex flex-col gap-3">
      <div
        className="bg-paper-200 relative aspect-[4/3] overflow-hidden rounded-[var(--radius-lg)] md:aspect-[16/10]"
        style={
          selected
            ? { backgroundColor: blurhashAverageColor(selected.blurhash) }
            : undefined
        }
      >
        {selected && (
          // eslint-disable-next-line @next/next/no-img-element -- a remote, already-optimised variant URL (same precedent as result-card.tsx).
          <img
            key={selected.id}
            src={widestUrl(selected.urls)}
            alt={selected.altText ?? title}
            className="opacity-transition size-full object-cover"
          />
        )}
      </div>

      {images.length > 1 && (
        <div className="flex flex-wrap gap-2 overflow-x-auto">
          {images.map((image) => {
            const kindLabel = KIND_LABEL[image.kind]
            const isSelected = image.id === selected?.id
            return (
              <div key={image.id} className="flex flex-col items-center gap-1">
                <button
                  type="button"
                  aria-pressed={isSelected}
                  aria-label={kindLabel ?? image.altText ?? title}
                  onClick={() => setSelectedId(image.id)}
                  className={cn(
                    'aspect-[4/3] w-20 shrink-0 overflow-hidden rounded-[var(--radius-sm)] border-2',
                    isSelected ? 'border-primary' : 'border-transparent',
                  )}
                >
                  {/* eslint-disable-next-line @next/next/no-img-element -- see the cover image's own note above. */}
                  <img
                    src={narrowestUrl(image.urls)}
                    alt=""
                    className="size-full object-cover"
                  />
                </button>
                {kindLabel && (
                  <span className="text-muted-foreground text-xs">
                    {kindLabel}
                  </span>
                )}
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
