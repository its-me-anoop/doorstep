import type { Channel } from '@/domain/enums'
import { ResultCard } from '@/components/features/search/result-card'
import type { AreaDefinition } from '@/lib/areas'
import type { PublicSearchHit } from '@/services/search/search-listings'

interface AreaIntroProps {
  area: AreaDefinition
  channel: Channel
  /** Up to 4, newest first (services/listings/list-newest-in-area.ts) —
   * Postgres-sourced, so this section (unlike the results grid below it)
   * survives a search-index outage (§1.10 point 4). */
  newest: PublicSearchHit[]
  /** The SSR result's live total — see this component's own doc comment
   * on why it's a snapshot, not re-fetched. */
  totalCount: number
  now: number
}

const CHANNEL_COPY: Record<Channel, string> = {
  sale: 'for sale in',
  rent: 'to rent in',
}

/**
 * AreaIntro — M2-DESIGN-SPEC.md §4.1. Renders directly after the results
 * page's `<h1>` (ResultsView's `areaSection` slot), only on the
 * canonical, zero-filter area URL — the caller
 * (app/(public)/for-sale/[area]/page.tsx) decides that, not this
 * component.
 *
 * `totalCount` is the SSR-fetched snapshot, not re-fetched on every
 * client interaction: the only state changes that keep this section
 * mounted (sort, page — §4.1's own "the moment a filter chip is added,
 * these sections stop rendering" rule) never change the total count, so
 * a static snapshot never goes stale for as long as this section stays
 * visible.
 */
export function AreaIntro({
  area,
  channel,
  newest,
  totalCount,
  now,
}: AreaIntroProps) {
  return (
    <div className="flex flex-col gap-8">
      <p className="text-foreground max-w-[65ch] text-base leading-relaxed">
        {area.intro}
      </p>

      {newest.length > 0 && (
        <div className="flex flex-col gap-4">
          <h2 className="text-foreground text-[length:var(--text-h4)]">
            Newest in {area.label}
          </h2>
          <div className="flex gap-4 overflow-x-auto lg:grid lg:grid-cols-4 lg:gap-6 lg:overflow-visible">
            {newest.map((hit) => (
              <div key={hit.id} className="w-64 shrink-0 lg:w-auto">
                <ResultCard hit={hit} now={now} />
              </div>
            ))}
          </div>
        </div>
      )}

      <a
        href="#listings"
        className="text-primary w-fit text-sm underline-offset-2 hover:underline"
      >
        Browse all {totalCount} homes {CHANNEL_COPY[channel]} {area.label} ↓
      </a>
    </div>
  )
}
