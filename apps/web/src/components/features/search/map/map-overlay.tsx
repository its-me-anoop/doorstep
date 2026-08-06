import Link from 'next/link'

import type { Channel } from '@/domain/enums'
import { Button } from '@/components/ui/button'

const CHANNEL_COPY: Record<Channel, string> = {
  sale: 'for sale in',
  rent: 'to rent in',
}

interface MapEmptyMessageProps {
  /** The unfiltered-for-this-tier URL (§3.8's link target, reused
   * verbatim here). */
  unfilteredHref: string
  areaLabel: string
  channel: Channel
}

/**
 * MapEmptyMessage — §1.8's "no results in the current viewport" copy.
 * Exported on its own (not only as a `MapOverlay` variant) because it
 * renders in two different places depending on layout: bare, inline in
 * the desktop split-view's list column (§1.8: "the map itself needs no
 * explanation... the teaching copy lives in the list column only"), and
 * wrapped in `MapOverlay`'s card on mobile full-screen map, where there
 * is no adjacent list column to hold it.
 */
export function MapEmptyMessage({
  unfilteredHref,
  areaLabel,
  channel,
}: MapEmptyMessageProps) {
  return (
    <div className="flex flex-col gap-2 text-left">
      <h2 className="text-foreground text-[length:var(--text-h4)]">
        Nothing in view right now.
      </h2>
      <p className="text-muted-foreground text-base leading-relaxed">
        Try zooming out or moving the map — or{' '}
        <Link
          href={unfilteredHref}
          className="text-primary underline-offset-2 hover:underline"
        >
          see all homes {CHANNEL_COPY[channel]} {areaLabel}
        </Link>{' '}
        without a location filter.
      </p>
    </div>
  )
}

type MapOverlayVariant =
  | {
      kind: 'empty'
      unfilteredHref: string
      areaLabel: string
      channel: Channel
    }
  | { kind: 'outage'; onRetry: () => void }
  | { kind: 'tiles-failed'; listHref: string }

interface MapOverlayProps {
  variant: MapOverlayVariant
}

/**
 * MapOverlay — §1.8's one shared card, three copy variants, used only
 * when the map is the *sole* visible surface (mobile full-screen map
 * mode, or desktop's tiles-failed case collapsing the map column). Flat,
 * no drop shadow, matching every other floating panel in this product
 * (the filter popover, the outage panel).
 */
export function MapOverlay({ variant }: MapOverlayProps) {
  return (
    <div className="bg-card border-border max-w-[280px] rounded-[var(--radius-md)] border p-4">
      {variant.kind === 'empty' && (
        <MapEmptyMessage
          unfilteredHref={variant.unfilteredHref}
          areaLabel={variant.areaLabel}
          channel={variant.channel}
        />
      )}

      {variant.kind === 'outage' && (
        <div className="flex flex-col gap-2 text-left">
          <h2 className="text-foreground text-[length:var(--text-h4)]">
            Search’s taking a breather.
          </h2>
          <p className="text-muted-foreground text-base leading-relaxed">
            We can’t load pins right now — it isn’t you.
          </p>
          <Button
            type="button"
            variant="secondary"
            onClick={variant.onRetry}
            className="mt-1 h-11 w-fit rounded-[var(--radius-md)] px-4"
          >
            Try again
          </Button>
        </div>
      )}

      {variant.kind === 'tiles-failed' && (
        <div className="flex flex-col gap-2 text-left">
          <h2 className="text-foreground text-[length:var(--text-h4)]">
            Map tiles aren’t loading right now.
          </h2>
          <p className="text-muted-foreground text-base leading-relaxed">
            <Link
              href={variant.listHref}
              className="text-primary underline-offset-2 hover:underline"
            >
              View as a list
            </Link>{' '}
            — everything else, including the properties themselves, is working
            fine.
          </p>
        </div>
      )}
    </div>
  )
}
