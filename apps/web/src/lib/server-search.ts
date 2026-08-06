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
import { buildSearchApiQuery, type SearchUrlState } from '@/lib/search-url'
import { searchQuerySchema } from '@/lib/validation/search'
import { SearchUnavailableError } from '@/services/search'
import type {
  PublicSearchResult,
  SearchListings,
} from '@/services/search/search-listings'

/** `null` on a search_unavailable outage (§1.10 point 4's SSR
 * equivalent) — the page renders the outage panel from first paint
 * rather than the route itself failing. Any other error propagates: an
 * SSR page throwing on a genuine bug is the correct default (surfaced by
 * Next's error boundary), not silently swallowed into a false "outage". */
export async function fetchInitialSearchResult(
  searchListings: SearchListings,
  state: SearchUrlState,
  channel: Channel,
): Promise<PublicSearchResult | null> {
  const query = searchQuerySchema.parse(buildSearchApiQuery(state, channel))

  try {
    return await searchListings.execute(query)
  } catch (error) {
    if (error instanceof SearchUnavailableError) return null
    throw error
  }
}
