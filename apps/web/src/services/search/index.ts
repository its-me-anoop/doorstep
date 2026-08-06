/**
 * services/search/
 *
 * The Postgres -> Meilisearch projection's pure mapping half (PRD §8.6):
 * mapListingToSearchDocument. The outbox drain worker that will call it
 * for real, and the /api/v1/search route that will call SearchIndex.search
 * (ports/search-index.ts), are later milestones — this directory is
 * one file and its errors until one of those lands.
 */

export { mapListingToSearchDocument } from './map-listing-to-search-document'
export { NotIndexableListingError } from './errors'
