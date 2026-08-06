/**
 * services/search/
 *
 * The Postgres -> Meilisearch projection's pure mapping half (PRD §8.6):
 * mapListingToSearchDocument (called for real by services/search-sync/'s
 * outbox drain worker and nightly reindex). SearchListings is the other
 * half — the use case behind GET /api/v1/search (PRD §10): translates a
 * validated public query into SearchIndex.search's port shape and maps
 * hits back to the public API's DTO.
 */

export { mapListingToSearchDocument } from './map-listing-to-search-document'
export { NotIndexableListingError, SearchUnavailableError } from './errors'
export { SearchListings, toPublicHit } from './search-listings'
export type {
  PublicSearchAgency,
  PublicSearchHit,
  PublicSearchResult,
} from './search-listings'
