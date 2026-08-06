/**
 * services/search-sync/
 *
 * The Postgres -> Meilisearch projection's sync half (PRD §8.6):
 * DrainOutbox (the every-minute cron worker) and RebuildSearchIndex (the
 * nightly full reindex). Both reuse services/search's phase-1
 * mapListingToSearchDocument rather than duplicating it.
 */

export { DrainOutbox, type DrainOutboxResult } from './drain-outbox'
export {
  RebuildSearchIndex,
  type RebuildSearchIndexDrift,
  type RebuildSearchIndexResult,
} from './rebuild-search-index'
