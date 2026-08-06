/**
 * adapters/meilisearch/ — implements SearchIndex (ports/search-index.ts)
 * against Meilisearch (PRD §8.6). Postgres stays the source of truth;
 * this adapter is a thin, swappable translation layer over the official
 * `meilisearch` npm client — nothing outside this file imports that
 * package (DIP), mirroring adapters/firebase/firebase-storage-adapter.ts's
 * "vendor SDK stays inside the adapter" shape.
 *
 * Lazy client, same reasoning as adapters/drizzle/client.ts's getDb() and
 * adapters/firebase/firebase-storage-adapter.ts's constructor: reads no
 * env var and opens no connection until a method is actually called, so
 * importing this module (transitively, via a future composition-root
 * wiring) never throws just because MEILISEARCH_HOST happens to be unset
 * for a request that doesn't touch search.
 *
 * "waitForTask helper for tests" (this task's brief): rather than expose
 * a raw Meilisearch client/task id for tests to poll themselves, every
 * write method below (`ensureSettings`, `upsert`, `delete`) already
 * chains the client's own `.waitTask()` (meilisearch-js 0.60's
 * EnqueuedTaskPromise) before resolving — by the time `await
 * searchIndex.upsert(docs)` returns, those documents are already
 * searchable. `assertTaskSucceeded` then turns a `status: 'failed'` task
 * (which `.waitTask()` itself resolves rather than throws for — a
 * malformed filter or bad settings value fails the *task*, not the HTTP
 * request that enqueued it) into a thrown error, so a caller can't
 * silently proceed as if a write had landed when it didn't.
 */

import { Meilisearch, type FacetDistribution, type Task } from 'meilisearch'

import type {
  GeoQuery,
  ListingSearchDocument,
  SearchFacetCounts,
  SearchIndex,
  SearchQuery,
  SearchQueryFilters,
  SearchResult,
  SearchSort,
} from '@/ports/search-index'

const DEFAULT_INDEX_PREFIX = 'doorstep'
const DEFAULT_HITS_PER_PAGE = 24

/** PRD §8.6's exact settings, as this task's brief lists them (the PRD's
 * own prose bullet omits `availableFrom`, but the "Query paths" bullet
 * right after it requires filtering `availableFromBefore`, which is
 * impossible unless the attribute is filterable — this list follows the
 * brief's explicit, corrected enumeration). */
export const FILTERABLE_ATTRIBUTES: readonly string[] = [
  'channel',
  'price',
  'bedrooms',
  'bathrooms',
  'propertyType',
  'tenure',
  'furnished',
  'newHome',
  'town',
  'outcode',
  '_geo',
  'availableFrom',
]
export const SORTABLE_ATTRIBUTES: readonly string[] = ['price', 'publishedAt']
export const SEARCHABLE_ATTRIBUTES: readonly string[] = [
  'title',
  'displayAddress',
  'town',
  'outcode',
]
/** Facet counts requested on every search() call (PRD §8.6: "Facet counts
 * power filter badges"). */
export const FACET_ATTRIBUTES: readonly string[] = [
  'propertyType',
  'furnished',
  'tenure',
  'bedrooms',
]

const SORT_EXPRESSIONS: Record<SearchSort, string[]> = {
  newest: ['publishedAt:desc'],
  price_asc: ['price:asc'],
  price_desc: ['price:desc'],
}

/** Reads MEILISEARCH_HOST, throwing a message that tells the operator
 * exactly what to set — mirrors adapters/drizzle/client.ts's
 * resolveDatabaseUrl and adapters/firebase/firebase-storage-adapter.ts's
 * resolveStorageBucket. */
export function resolveMeilisearchHost(
  env: Record<string, string | undefined>,
): string {
  const host = env.MEILISEARCH_HOST
  if (!host) {
    throw new Error(
      'MEILISEARCH_HOST is not set. It is required to initialise ' +
        'MeilisearchSearchIndex — set it to your Meilisearch instance URL, ' +
        'e.g. MEILISEARCH_HOST=http://127.0.0.1:7700 for local dev.',
    )
  }
  return host
}

/** `{MEILISEARCH_INDEX_PREFIX}-listings`, defaulting the prefix to
 * "doorstep" (this task's brief). Pure and exported so it's unit-testable
 * without a live daemon; tests/integration/meilisearch-adapter.test.ts
 * also uses it to compute a per-run, disposable index name via a
 * per-run prefix. */
export function resolveMeilisearchIndexName(
  env: Record<string, string | undefined>,
): string {
  const prefix = env.MEILISEARCH_INDEX_PREFIX || DEFAULT_INDEX_PREFIX
  return `${prefix}-listings`
}

/** Meilisearch's filter grammar quotes string literals with double
 * quotes; JSON.stringify produces exactly that (and correctly escapes any
 * embedded quote/backslash), so it doubles as the quoting function rather
 * than hand-rolling escaping. */
function quote(value: string): string {
  return JSON.stringify(value)
}

function buildGeoClause(geo: GeoQuery): string {
  if (geo.kind === 'radius') {
    return `_geoRadius(${geo.lat}, ${geo.lng}, ${geo.radiusMetres})`
  }
  return `_geoBoundingBox([${geo.topRight.lat}, ${geo.topRight.lng}], [${geo.bottomLeft.lat}, ${geo.bottomLeft.lng}])`
}

function buildFilterClauses(filters: SearchQueryFilters | undefined): string[] {
  if (!filters) return []
  const clauses: string[] = []

  // Price bounds are both inclusive (>=/<=), matching a user's mental
  // model of "between £X and £Y" including the endpoints.
  if (filters.priceMin !== undefined) {
    clauses.push(`price >= ${filters.priceMin}`)
  }
  if (filters.priceMax !== undefined) {
    clauses.push(`price <= ${filters.priceMax}`)
  }
  if (filters.bedroomsMin !== undefined) {
    clauses.push(`bedrooms >= ${filters.bedroomsMin}`)
  }
  if (filters.bedroomsMax !== undefined) {
    clauses.push(`bedrooms <= ${filters.bedroomsMax}`)
  }
  if (filters.bathroomsMin !== undefined) {
    clauses.push(`bathrooms >= ${filters.bathroomsMin}`)
  }
  // Multi-select: any of the chosen types matches (OR), the group as a
  // whole still ANDs with every other filter (PRD §8.6).
  if (filters.propertyTypes && filters.propertyTypes.length > 0) {
    clauses.push(
      `(${filters.propertyTypes
        .map((type) => `propertyType = ${quote(type)}`)
        .join(' OR ')})`,
    )
  }
  if (filters.tenure) clauses.push(`tenure = ${quote(filters.tenure)}`)
  if (filters.furnished) clauses.push(`furnished = ${quote(filters.furnished)}`)
  if (filters.availableFromBefore) {
    // Lexicographic string comparison on a YYYY-MM-DD value sorts
    // identically to chronological order — see
    // ports/search-index.ts's ListingSearchDocument.availableFrom doc
    // comment. A listing with no availableFrom (sale, or rent with no
    // move-in date yet) simply doesn't match this clause, which is the
    // desired behaviour: this filter is only ever applied to rent
    // searches with a real date to compare against.
    clauses.push(`availableFrom < ${quote(filters.availableFromBefore)}`)
  }
  if (filters.newHome !== undefined)
    clauses.push(`newHome = ${filters.newHome}`)
  if (filters.town) clauses.push(`town = ${quote(filters.town)}`)
  if (filters.outcode) clauses.push(`outcode = ${quote(filters.outcode)}`)

  return clauses
}

/**
 * Translates a SearchQuery into a Meilisearch `filter` expression string
 * (PRD §8.6: "filters as AND-joined Meilisearch filter expressions").
 * `channel` is always the first clause (the one required field); every
 * other clause is appended only when the caller actually supplied it.
 * Pure and exported so every filter/geo translation is unit-testable
 * without a live daemon —
 * tests/integration/meilisearch-adapter.test.ts then proves each one
 * actually narrows a real index.
 */
export function buildFilterExpression(query: SearchQuery): string {
  const clauses = [
    `channel = ${quote(query.channel)}`,
    ...buildFilterClauses(query.filters),
  ]
  if (query.geo) clauses.push(buildGeoClause(query.geo))
  return clauses.join(' AND ')
}

/** PRD §8.6: "sort newest -> publishedAt:desc, price_asc/desc ->
 * price:asc/desc". Defaults to 'newest' when the caller omits `sort`. */
export function buildSortExpression(sort: SearchSort | undefined): string[] {
  return SORT_EXPRESSIONS[sort ?? 'newest']
}

/** Maps Meilisearch's `facetDistribution` response into
 * ports/search-index.ts's SearchFacetCounts shape. `propertyType` always
 * appears (defaulting to `{}` if the response somehow omitted it — every
 * document has one, so an empty result set is the only way this
 * happens); every other requested facet is included only when the
 * response actually returned it. */
export function mapFacetDistribution(
  distribution: FacetDistribution | undefined,
): SearchFacetCounts {
  return {
    propertyType: distribution?.propertyType ?? {},
    ...(distribution?.furnished ? { furnished: distribution.furnished } : {}),
    ...(distribution?.tenure ? { tenure: distribution.tenure } : {}),
    ...(distribution?.bedrooms ? { bedrooms: distribution.bedrooms } : {}),
  }
}

/** `.waitTask()` resolves once a task leaves `enqueued`/`processing` —
 * including into `failed` (it does not throw for that itself, see this
 * file's header comment). This turns a failed task into a thrown error so
 * callers can't mistake "the write finished" for "the write succeeded". */
function assertTaskSucceeded(task: Task): void {
  if (task.status === 'failed') {
    throw new Error(
      `Meilisearch task ${task.uid} (${task.type}) failed: ${
        task.error?.message ?? 'unknown error'
      }`,
    )
  }
}

export class MeilisearchSearchIndex implements SearchIndex {
  private readonly env: Record<string, string | undefined>
  private clientInstance: Meilisearch | undefined

  /** Reads no env var and opens no connection in the constructor — see
   * this file's header comment. */
  constructor(env: Record<string, string | undefined> = process.env) {
    this.env = env
  }

  private client(): Meilisearch {
    if (!this.clientInstance) {
      this.clientInstance = new Meilisearch({
        host: resolveMeilisearchHost(this.env),
        apiKey: this.env.MEILISEARCH_API_KEY,
      })
    }
    return this.clientInstance
  }

  private index() {
    return this.client().index<ListingSearchDocument>(
      resolveMeilisearchIndexName(this.env),
    )
  }

  async ensureSettings(): Promise<void> {
    const task = await this.index()
      .updateSettings({
        filterableAttributes: [...FILTERABLE_ATTRIBUTES],
        sortableAttributes: [...SORTABLE_ATTRIBUTES],
        searchableAttributes: [...SEARCHABLE_ATTRIBUTES],
      })
      .waitTask()
    assertTaskSucceeded(task)
  }

  async upsert(documents: ListingSearchDocument[]): Promise<void> {
    if (documents.length === 0) return
    const task = await this.index()
      .addDocuments(documents, { primaryKey: 'id' })
      .waitTask()
    assertTaskSucceeded(task)
  }

  async delete(ids: string[]): Promise<void> {
    if (ids.length === 0) return
    const task = await this.index().deleteDocuments(ids).waitTask()
    assertTaskSucceeded(task)
  }

  async search(query: SearchQuery): Promise<SearchResult> {
    const response = await this.index().search(null, {
      filter: buildFilterExpression(query),
      sort: buildSortExpression(query.sort),
      facets: [...FACET_ATTRIBUTES],
      page: query.page,
      hitsPerPage: query.hitsPerPage ?? DEFAULT_HITS_PER_PAGE,
    })

    return {
      hits: response.hits,
      totalHits: response.totalHits,
      page: response.page,
      totalPages: response.totalPages,
      facets: mapFacetDistribution(response.facetDistribution),
    }
  }

  async countDocuments(): Promise<number> {
    const stats = await this.index().getStats()
    return stats.numberOfDocuments
  }

  async healthy(): Promise<boolean> {
    return this.client().isHealthy()
  }
}
