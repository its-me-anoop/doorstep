import { redirect } from 'next/navigation'

import type { Channel } from '@/domain/enums'
import { Breadcrumb } from '@/components/features/search/breadcrumb'
import { ResultsView } from '@/components/features/search/results-view'
import { createServices } from '@/lib/composition'
import type { SearchHeadingTier } from '@/lib/search-heading'
import { fetchInitialSearchResult } from '@/lib/server-search'
import {
  needsCanonicalRedirect,
  nextSearchParamsToURLSearchParams,
  parseSearchUrlState,
  stripFiltersKeepLocation,
} from '@/lib/search-url'

interface SearchResultsPageProps {
  channel: Channel
  tier: SearchHeadingTier
  rawSearchParams: Record<string, string | string[] | undefined>
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
}: SearchResultsPageProps) {
  const basePath = `/${CHANNEL_SLUG[channel]}${tier === 'search' ? '/search' : ''}`
  const rawParams = nextSearchParamsToURLSearchParams(rawSearchParams)

  const canonicalQuery = needsCanonicalRedirect(rawParams)
  if (canonicalQuery !== null) {
    redirect(canonicalQuery ? `${basePath}?${canonicalQuery}` : basePath)
  }

  const state = parseSearchUrlState(rawParams)
  const { search } = createServices()
  const initialResult = await fetchInitialSearchResult(
    search.searchListings,
    state,
    channel,
  )
  const now = currentUnixSeconds()

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

  const finalCrumbLabel =
    tier === 'search' ? (state.label ?? 'Search') : CHANNEL_CRUMB_LABEL[channel]

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
          tier === 'search'
            ? {
                label: CHANNEL_CRUMB_LABEL[channel],
                href: basePath.replace('/search', ''),
              }
            : { label: CHANNEL_CRUMB_LABEL[channel] },
          ...(tier === 'search' ? [{ label: finalCrumbLabel }] : []),
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
        />
      </div>
    </div>
  )
}
