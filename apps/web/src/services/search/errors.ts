/**
 * Errors thrown by services/search/*. Same { name, ...context } shape as
 * services/listings/errors.ts and services/images/errors.ts.
 * NotIndexableListingError has no route mapping it directly — the outbox
 * drain worker (services/search-sync/) is its only caller. SearchUnavailableError
 * is mapped by GET /api/v1/search to a 503 (PRD §7.6's graceful
 * degradation).
 */

import type { PropertyStatus } from '@/domain/enums'

/**
 * map-listing-to-search-document.ts rejects any listing whose status
 * isn't publicly visible (PRD §8.6: "Only publicly visible listings
 * (published, under offer) are indexed"). The (future) outbox drain
 * worker is expected to call the mapper only for `op: 'upsert'` outbox
 * rows, which per ports/listing-repository.ts's ListingSideEffects/
 * ListingTransitionOptions doc comments are themselves only ever written
 * while a listing is published/under_offer — so in practice this guards
 * against a caller bypassing that invariant, not a normal, expected
 * business case.
 */
export class NotIndexableListingError extends Error {
  readonly id: string
  readonly status: PropertyStatus

  constructor(id: string, status: PropertyStatus) {
    super(
      `Listing ${id} has status "${status}" and is not publicly visible — only published and under_offer listings are indexable`,
    )
    this.name = 'NotIndexableListingError'
    this.id = id
    this.status = status
  }
}

/**
 * SearchListings (services/search/search-listings.ts) throws this when
 * SearchIndex.healthy() reports false, or when SearchIndex.search itself
 * throws — Meilisearch being briefly unreachable is an expected failure
 * mode (PRD §7.6: "graceful degradation" when the search index is down),
 * not a 500. GET /api/v1/search maps this to
 * `503 { error: { code: 'search_unavailable' } }`; the UI phase renders
 * the friendly outage state from that response.
 */
export class SearchUnavailableError extends Error {
  constructor(cause?: unknown) {
    super('The search index is temporarily unavailable')
    this.name = 'SearchUnavailableError'
    this.cause = cause
  }
}
