import type { Channel } from '@/domain/enums'

interface StatusBannerProps {
  /** GetPublicListing's `displayStatus` (getDisplayStatus's output) —
   * `'published'` renders nothing, anything else (only ever "Sold STC" /
   * "Let Agreed" reach this page, per PRD §8.6's published/under_offer
   * pair) renders the banner using that exact label. */
  displayStatus: string
  channel: Channel
}

const BODY_COPY: Record<Channel, string> = {
  sale: 'This home has an offer accepted and may not be available.',
  rent: 'This home is under offer and may not be available.',
}

/**
 * StatusBanner — M2-DESIGN-SPEC.md §5.2. Full-width band under the
 * breadcrumb, above the media, rendered only for `under_offer` — the
 * default `published` case (the vast majority of listings) needs no
 * banner at all, so this frequently renders nothing. Icon-free: the
 * solid `--status-underoffer-*` fill is already an attention-grabbing
 * treatment on its own (reused unchanged from M1's status badge pair).
 */
export function StatusBanner({ displayStatus, channel }: StatusBannerProps) {
  if (displayStatus === 'published') return null

  return (
    <div className="bg-status-underoffer-bg text-status-underoffer-fg rounded-[var(--radius-md)] p-4">
      <p className="text-base leading-relaxed">
        <strong className="font-semibold">{displayStatus}</strong> —{' '}
        {BODY_COPY[channel]}
      </p>
    </div>
  )
}
