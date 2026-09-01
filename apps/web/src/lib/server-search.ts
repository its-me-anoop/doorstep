/**
 * The SSR fetch behind every results page (PRD §8.3: "the shell
 * server-renders with initial results for SEO on crawlable filter
 * URLs"). Translates `SearchUrlState` through `buildSearchApiQuery` and
 * `searchQuerySchema` — the exact same validated shape GET
 * /api/v1/search itself parses — then calls `SearchListings.execute`
 * directly (composition-root pattern, matching app/(lister)/lister/
 * page.tsx's own precedent: a server component calls the service
 * straight from `createServices()`, no internal HTTP round trip to its
 * own API route).
 */

import type { Channel } from '@/domain/enums'
import {
  buildSearchApiQuery,
  type SearchAreaFilter,
  type SearchUrlState,
} from '@/lib/search-url'
import { searchQuerySchema } from '@/lib/validation/search'
import { SearchUnavailableError } from '@/services/search'
import {
  emptySearchResult,
  type PublicSearchResult,
  type SearchListings,
} from '@/services/search/search-listings'

/** First paint of `/for-sale` and `/to-rent` must be a real result page
 * or the genuine empty-listings state — never the outage panel. A
 * SearchUnavailableError here (empty/unconfigured index after recovery,
 * or a transient daemon blip on the unrestricted query) becomes an
 * empty `PublicSearchResult`, not `null`. `null` used to mean "render
 * OutagePanel from SSR," which is what first load was still hitting.
 * Filtered/geo client re-queries can still surface the outage panel.
 * Any other error still propagates to Next's error boundary.
 * `areaFilter` (§4) scopes the fetch to a curated area's town/outcode —
 * omitted for the unrestricted/search tiers, which have none. */
export async function fetchInitialSearchResult(
  searchListings: SearchListings,
  state: SearchUrlState,
  channel: Channel,
  areaFilter?: SearchAreaFilter,
): Promise<PublicSearchResult> {
  const query = searchQuerySchema.parse(
    buildSearchApiQuery(state, channel, areaFilter),
  )

  try {
    return await searchListings.execute(query)
  } catch (error) {
    if (error instanceof SearchUnavailableError) {
      return emptySearchResult(query.page)
    }
    throw error
  }
}
