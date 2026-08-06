import Link from 'next/link'

import type { Channel } from '@/domain/enums'

interface EmptyStateProps {
  /** The unfiltered-for-this-area URL (all filters stripped, location
   * kept) — §3.8's bracketed link target. */
  unfilteredHref: string
  areaLabel: string
  channel?: Channel
}

const CHANNEL_COPY: Record<Channel, string> = {
  sale: 'for sale in',
  rent: 'to rent in',
}

/**
 * EmptyState — §3.8. "Teach the way out," not "No results found." The
 * spec also describes an optional heuristic ("name the likeliest culprit
 * specifically... e.g. 'Try raising your maximum price'") explicitly
 * flagged as "not exact science" with the generic copy below as its own
 * stated safe fallback — that heuristic is a deliberate scope cut here
 * (no test-verifiable rule for "which filter looks narrowest," so this
 * ships the fallback it already names as correct on its own).
 */
export function EmptyState({
  unfilteredHref,
  areaLabel,
  channel = 'sale',
}: EmptyStateProps) {
  return (
    <div className="flex max-w-[60ch] flex-col items-start gap-3 py-4 text-left">
      <h2 className="text-foreground text-[length:var(--text-h4)]">
        Nothing matches those filters yet.
      </h2>
      <p className="text-muted-foreground text-base leading-relaxed">
        Try widening your price range or removing a filter above — or{' '}
        <Link
          href={unfilteredHref}
          className="text-primary underline-offset-2 hover:underline"
        >
          see all homes {CHANNEL_COPY[channel]} {areaLabel}
        </Link>{' '}
        with no filters applied.
      </p>
    </div>
  )
}
