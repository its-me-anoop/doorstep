import type { Channel } from '@/domain/enums'
import { cn } from '@/lib/utils'

export interface ChannelSegmentedControlProps {
  value: Channel
  onChange: (channel: Channel) => void
  className?: string
  /** `h-14` on the hero (§2.1, `lg`), `h-11` everywhere else (§3.2,
   * `md`) — a size prop rather than two components, since it's the same
   * control at two sizes, not two different controls. */
  size?: 'lg' | 'md'
  /** `false` when a parent assembly (hero-search-box.tsx) owns the
   * outer border/radius itself at desktop width, so this control's own
   * border doesn't double up inside it (§2.1: "no visible internal
   * border between it and the channel segment... reads as one search
   * instrument"). Defaults `true` — every other/standalone usage
   * (§3.2's results-page toggle) keeps its own border. */
  bordered?: boolean
}

const CHANNEL_LABEL: Record<Channel, string> = {
  sale: 'For sale',
  rent: 'To rent',
}

/**
 * ChannelSegmentedControl — the Buy/Rent visual (§2.1, §3.2): two joined
 * buttons rather than a `<select>` (a primary, thumb-reachable choice,
 * not a configuration field). Purely controlled/presentational — no
 * navigation of its own — because its two consumers need different
 * commit behaviour: the hero's toggle only picks which channel the
 * eventual Search submit targets (ChannelSegmentedControl used directly
 * with local state, in hero-search-box.tsx), while the results page's
 * toggle navigates immediately on selection (ChannelToggle wraps this
 * component with that navigation logic). Splitting the visual from the
 * commit behaviour is what lets both reuse one control instead of
 * hand-rolling two.
 */
export function ChannelSegmentedControl({
  value,
  onChange,
  className,
  size = 'md',
  bordered = true,
}: ChannelSegmentedControlProps) {
  const heightClass = size === 'lg' ? 'h-12 md:h-14' : 'h-11'

  return (
    <div
      role="group"
      aria-label="Buy or rent"
      className={cn(
        'inline-flex overflow-hidden',
        bordered && 'border-input rounded-[var(--radius-md)] border',
        heightClass,
        className,
      )}
    >
      {(['sale', 'rent'] as const).map((option) => {
        const active = option === value
        return (
          <button
            key={option}
            type="button"
            aria-pressed={active}
            onClick={() => onChange(option)}
            className={cn(
              'flex-1 px-4 text-sm font-medium transition-colors',
              active
                ? 'bg-primary text-primary-foreground'
                : 'text-foreground hover:bg-muted bg-transparent',
            )}
          >
            {CHANNEL_LABEL[option]}
          </button>
        )
      })}
    </div>
  )
}
