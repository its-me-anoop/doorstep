'use client'

import {
  AlertTriangle,
  ArrowLeft,
  ArrowRight,
  GripVertical,
  X,
} from 'lucide-react'

import { blurhashAverageColor } from '@/lib/blurhash-preview'

import type { PhotoTileItem } from './photo-tile-item'

interface PhotoTileProps {
  item: PhotoTileItem
  isCover: boolean
  canMoveEarlier: boolean
  canMoveLater: boolean
  onMakeCover?: () => void
  onMoveEarlier?: () => void
  onMoveLater?: () => void
  onRemove?: () => void
  onRetry?: () => void
  onDragStart?: () => void
  onDropOnto?: () => void
}

const tileActionClassName =
  'flex min-h-11 min-w-11 items-center justify-center rounded-[var(--radius-sm)] bg-background/90 text-foreground'

/**
 * PhotoTile — the one tile renderer for every state a photo can be in
 * (M1-DESIGN-SPEC.md §1.5): server-confirmed and ready, mid-upload,
 * mid-processing, or errored. `photo-grid.tsx` decides *which* item to
 * render; this component only knows how to render one.
 */
export function PhotoTile({
  item,
  isCover,
  canMoveEarlier,
  canMoveLater,
  onMakeCover,
  onMoveEarlier,
  onMoveLater,
  onRemove,
  onRetry,
  onDragStart,
  onDropOnto,
}: PhotoTileProps) {
  if (item.status === 'ready') {
    const thumbnail = item.image.urls[0]
    return (
      <div
        data-testid="photo-tile"
        draggable
        onDragStart={() => onDragStart?.()}
        onDragOver={(event) => event.preventDefault()}
        onDrop={(event) => {
          event.preventDefault()
          onDropOnto?.()
        }}
        className="group focus-within:ring-ring/50 relative aspect-[4/3] overflow-hidden rounded-[var(--radius-sm)] focus-within:ring-3"
        style={{ backgroundColor: blurhashAverageColor(item.image.blurhash) }}
      >
        {thumbnail && (
          // eslint-disable-next-line @next/next/no-img-element -- a remote, already-optimised (sharp-generated webp/avif) variant URL, not a local asset next/image would process.
          <img
            src={thumbnail.url}
            alt={`Property photo ${item.image.position + 1}`}
            className="opacity-transition size-full object-cover"
          />
        )}

        {isCover && (
          <span className="bg-secondary text-secondary-foreground absolute top-2 left-2 rounded-[var(--radius-sm)] px-2 py-0.5 text-xs font-medium">
            Cover
          </span>
        )}

        <div className="pointer-events-none absolute inset-0 flex flex-col justify-between p-2 opacity-0 transition-opacity group-focus-within:opacity-100 group-hover:opacity-100">
          <div className="pointer-events-auto flex items-center justify-between gap-1">
            <span aria-hidden="true" className={tileActionClassName}>
              <GripVertical className="size-4" />
            </span>
            <div className="flex items-center gap-1">
              {!isCover && (
                <button
                  type="button"
                  onClick={onMakeCover}
                  className={`${tileActionClassName} px-2 text-xs font-medium`}
                >
                  Make cover
                </button>
              )}
              <button
                type="button"
                onClick={onRemove}
                aria-label="Remove"
                className={tileActionClassName}
              >
                <X className="size-4" />
              </button>
            </div>
          </div>
          <div className="pointer-events-auto flex items-center justify-center gap-1">
            <button
              type="button"
              onClick={onMoveEarlier}
              disabled={!canMoveEarlier}
              aria-label="Move earlier"
              className={`${tileActionClassName} disabled:pointer-events-none disabled:opacity-40`}
            >
              <ArrowLeft className="size-4" />
            </button>
            <button
              type="button"
              onClick={onMoveLater}
              disabled={!canMoveLater}
              aria-label="Move later"
              className={`${tileActionClassName} disabled:pointer-events-none disabled:opacity-40`}
            >
              <ArrowRight className="size-4" />
            </button>
          </div>
        </div>
      </div>
    )
  }

  if (item.status === 'uploading') {
    return (
      <div className="bg-secondary relative aspect-[4/3] overflow-hidden rounded-[var(--radius-sm)]">
        <div
          role="progressbar"
          aria-label={`Uploading ${item.fileName}`}
          aria-valuenow={Math.round(item.progress * 100)}
          aria-valuemin={0}
          aria-valuemax={100}
          className="bg-paper-200 absolute inset-x-0 bottom-0 h-1"
        >
          <div
            className="h-full origin-left bg-[var(--clay-500)] transition-transform duration-200 ease-out"
            style={{ transform: `scaleX(${item.progress})` }}
          />
        </div>
      </div>
    )
  }

  if (item.status === 'processing') {
    return (
      <div className="bg-paper-200 photo-tile-processing relative flex aspect-[4/3] items-center justify-center overflow-hidden rounded-[var(--radius-sm)]">
        <p className="photo-tile-processing-label text-muted-foreground text-xs">
          Processing…
        </p>
      </div>
    )
  }

  return (
    <div className="bg-secondary relative flex aspect-[4/3] flex-col items-center justify-center gap-2 overflow-hidden rounded-[var(--radius-sm)] p-3 text-center">
      <AlertTriangle aria-hidden="true" className="text-destructive size-5" />
      <p className="text-destructive text-xs leading-snug">{item.message}</p>
      <button
        type="button"
        onClick={onRetry}
        className="text-primary text-xs font-medium underline underline-offset-2"
      >
        Retry
      </button>
    </div>
  )
}
