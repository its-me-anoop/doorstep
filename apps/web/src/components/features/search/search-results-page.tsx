import { redirect } from 'next/navigation'

import type { Channel } from '@/domain/enums'
import { AreaIntro } from '@/components/features/search/area-intro'
import { Breadcrumb } from '@/components/features/search/breadcrumb'
import { ResultsView } from '@/components/features/search/results-view'
import { areaMatchToFilter, type AreaDefinition } from '@/lib/areas'
import { createServices } from '@/lib/composition'
import type { SearchHeadingTier } from '@/lib/search-heading'
import { fetchInitialSearchResult } from '@/lib/server-search'
import {
  hasActiveSearchFilters,
  needsCanonicalRedirect,
  nextSearchParamsToURLSearchParams,
  parseSearchUrlState,
  stripFiltersKeepLocation,
  type SearchAreaFilter,
} from '@/lib/search-url'
import type { ListNewestInArea } from '@/services/listings'
import type { PublicSearchHit } from '@/services/search/search-listings'

interface SearchResultsPageProps {
  channel: Channel
  tier: SearchHeadingTier
  rawSearchParams: Record<string, string | string[] | undefined>
  /** Required (by convention — see this file's own tests) when
   * `tier === 'area'`; the curated area this page is scoped to (§4).
   * Ignored for every other tier. */
  area?: AreaDefinition
}

const CHANNEL_SLUG: Record<Channel, string> = {
  sale: 'for-sale',
  rent: 'to-rent',
}

const CHANNEL_CRUMB_LABEL: Record<Channel, string> = {
  sale: 'For sale',
  rent: 'To rent',
}

/** Extracted out of the component body so `Date.now()` isn't a direct
 * call inside a render function — this is a server component re-run
 * fresh per request (not a client re-render `Date.now()`'s impurity
 * warning is really about), but the read is still genuinely
 * request-time-only data, so it's kept as an explicit, named,
 * single-purpose function rather than inlined. */
function currentUnixSeconds(): number {
  return Math.floor(Date.now() / 1000)
}

/**
 * The newest-in-area strip is Postgres-backed decoration on top of the
 * results grid, not the grid itself (see AreaIntro's own doc comment) —
 * M2-DESIGN-SPEC.md §1.10 point 4's "area landing pages don't fully
 * degrade... independent of Meilisearch" line is written assuming
 * Postgres itself stays up; it says nothing about a Postgres outage.
 * Confirmed via a real e2e run against a DB-unreachable environment
 * (tests/e2e/m2.smoke.spec.ts): before this fallback existed, a failed
 * read here propagated uncaught out of this server component and 500'd
 * the whole area page — worse than the Meilisearch-outage case this same
 * page already degrades gracefully from. Falls back to the exact same
 * empty-array shape a genuinely newest-strip-free area already produces
 * (AreaIntro renders nothing for `newest.length === 0`), logged so the
 * failure is still visible server-side. */
async function fetchNewestInArea(
  listNewestInArea: ListNewestInArea,
  channel: Channel,
  areaFilter: SearchAreaFilter,
): Promise<PublicSearchHit[]> {
  try {
    return await listNewestInArea.execute(channel, areaFilter)
  } catch (error) {
    console.error('SearchResultsPage: listNewestInArea failed:', error)
    return []
  }
}

/**
 * SearchResultsPage — the shared server-rendered shell behind all four
 * results routes (app/(public)/for-sale/page.tsx, to-rent/page.tsx, and
 * their /search variants). One implementation parameterised by
 * `channel`/`tier` rather than four near-duplicate route files: each
 * route's own `page.tsx` is a thin wrapper naming which of the two it
 * is (SRP — the route file's only job is "which URL am I," not "how do
 * results pages work").
 *
 * Handles, in order: the canonical-URL redirect (§1.7), the SSR initial
 * fetch (PRD §8.3, via `SearchListings.execute` directly — no internal
 * HTTP round trip), and the page chrome (breadcrumb + rel=prev/next)
 * around the client `ResultsView`.
 */
export async function SearchResultsPage({
  channel,
  tier,
  rawSearchParams,
  area,
}: SearchResultsPageProps) {
  const basePath = area
    ? `/${CHANNEL_SLUG[channel]}/${area.slug}`
    : `/${CHANNEL_SLUG[channel]}${tier === 'search' ? '/search' : ''}`
  const rawParams = nextSearchParamsToURLSearchParams(rawSearchParams)

  const canonicalQuery = needsCanonicalRedirect(rawParams)
  if (canonicalQuery !== null) {
    redirect(canonicalQuery ? `${basePath}?${canonicalQuery}` : basePath)
  }

  const state = parseSearchUrlState(rawParams)
  const areaFilter = area ? areaMatchToFilter(area.match) : undefined
  const { search, listings } = createServices()
  const initialResult = await fetchInitialSearchResult(
    search.searchListings,
    state,
    channel,
    areaFilter,
  )
  const now = currentUnixSeconds()

  // §4.1: the intro/newest-strip section renders only on the canonical,
  // zero-filter area URL — the moment a filter is active, this page is
  // "results for {area} with a filter," not "the {area} landing page."
  const showAreaSection = Boolean(area) && !hasActiveSearchFilters(state)
  const newestInArea =
    showAreaSection && area && areaFilter
      ? await fetchNewestInArea(listings.listNewestInArea, channel, areaFilter)
      : []

  const unfilteredHref =
    tier === 'search'
      ? (() => {
          const location = stripFiltersKeepLocation(state)
          const params = new URLSearchParams()
          if (location.lat !== undefined)
            params.set('lat', String(location.lat))
          if (location.lng !== undefined)
            params.set('lng', String(location.lng))
          if (location.radius !== undefined)
            params.set('radius', String(location.radius))
          if (location.label) params.set('label', location.label)
          const query = params.toString()
          return query ? `${basePath}?${query}` : basePath
        })()
      : basePath

  const hasThirdCrumb = tier === 'search' || tier === 'area'
  const finalCrumbLabel =
    tier === 'area'
      ? (area?.label ?? '')
      : tier === 'search'
        ? (state.label ?? 'Search')
        : CHANNEL_CRUMB_LABEL[channel]

  const prevHref =
    initialResult && initialResult.page > 1
      ? `${basePath}?page=${initialResult.page - 1}`
      : null
  const nextHref =
    initialResult && initialResult.page < initialResult.totalPages
      ? `${basePath}?page=${initialResult.page + 1}`
      : null

  return (
    <div className="mx-auto max-w-[1200px] px-5 py-10 sm:px-8 lg:px-16">
      {prevHref && <link rel="prev" href={prevHref} />}
      {nextHref && <link rel="next" href={nextHref} />}

      <Breadcrumb
        items={[
          { label: 'Home', href: '/' },
          hasThirdCrumb
            ? {
                label: CHANNEL_CRUMB_LABEL[channel],
                href: `/${CHANNEL_SLUG[channel]}`,
              }
            : { label: CHANNEL_CRUMB_LABEL[channel] },
          ...(hasThirdCrumb ? [{ label: finalCrumbLabel }] : []),
        ]}
      />

      <div className="mt-6">
        <ResultsView
          channel={channel}
          basePath={basePath}
          tier={tier}
          initialResult={initialResult}
          unfilteredHref={unfilteredHref}
          now={now}
          areaFilter={areaFilter}
          areaLabel={area?.label}
          areaSection={
            showAreaSection && area ? (
              <AreaIntro
                area={area}
                channel={channel}
                newest={newestInArea}
                totalCount={initialResult?.totalCount ?? 0}
                now={now}
              />
            ) : undefined
          }
        />
      </div>
    </div>
  )
}
