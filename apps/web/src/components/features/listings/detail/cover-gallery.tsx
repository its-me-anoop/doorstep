'use client'

import { Maximize2, X } from 'lucide-react'
import { useEffect, useState } from 'react'

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
  const [lightboxOpen, setLightboxOpen] = useState(false)
  const selected = images.find((image) => image.id === selectedId) ?? images[0]

  const photos = images.filter((image) => image.kind === 'photo')
  const floorplans = images.filter((image) => image.kind === 'floorplan')
  const epcImages = images.filter((image) => image.kind === 'epc')
  const hasTabs = floorplans.length > 0 || epcImages.length > 0
  const [activeTab, setActiveTab] = useState<'photos' | 'floorplan' | 'epc'>(
    'photos',
  )

  const tabImages =
    activeTab === 'floorplan'
      ? floorplans
      : activeTab === 'epc'
        ? epcImages
        : photos.length > 0
          ? photos
          : images

  useEffect(() => {
    if (!tabImages.some((image) => image.id === selectedId)) {
      setSelectedId(tabImages[0]?.id)
    }
  }, [activeTab, selectedId, tabImages])

  useEffect(() => {
    if (!lightboxOpen) return
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') setLightboxOpen(false)
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [lightboxOpen])

  return (
    <div className="flex flex-col gap-3">
      {hasTabs && (
        <div className="flex gap-2">
          {(['photos', 'floorplan', 'epc'] as const).map((tab) => {
            const count =
              tab === 'photos'
                ? photos.length || images.length
                : tab === 'floorplan'
                  ? floorplans.length
                  : epcImages.length
            if (count === 0) return null
            return (
              <button
                key={tab}
                type="button"
                onClick={() => setActiveTab(tab)}
                className={cn(
                  'rounded-[var(--radius-sm)] px-3 py-1 text-sm font-medium',
                  activeTab === tab
                    ? 'bg-secondary text-secondary-foreground'
                    : 'text-muted-foreground hover:text-foreground',
                )}
              >
                {tab === 'photos'
                  ? 'Photos'
                  : tab === 'floorplan'
                    ? 'Floorplan'
                    : 'EPC'}
              </button>
            )
          })}
        </div>
      )}

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
        {selected && (
          <button
            type="button"
            aria-label="View full screen"
            onClick={() => setLightboxOpen(true)}
            className="bg-card/90 text-foreground absolute right-3 bottom-3 flex size-10 items-center justify-center rounded-[var(--radius-md)] shadow-sm"
          >
            <Maximize2 className="size-4" />
          </button>
        )}
      </div>

      {tabImages.length > 1 && (
        <div className="flex flex-wrap gap-2 overflow-x-auto">
          {tabImages.map((image) => {
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

      {lightboxOpen && selected && (
        <div
          className="bg-ink-900/90 fixed inset-0 z-50 flex items-center justify-center p-4"
          role="dialog"
          aria-modal="true"
          aria-label="Image gallery"
        >
          <button
            type="button"
            aria-label="Close"
            onClick={() => setLightboxOpen(false)}
            className="text-primary-foreground absolute top-4 right-4 flex size-10 items-center justify-center"
          >
            <X className="size-6" />
          </button>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={widestUrl(selected.urls)}
            alt={selected.altText ?? title}
            className="max-h-[90vh] max-w-full object-contain"
          />
        </div>
      )}
    </div>
  )
}
