/**
 * SearchIndex — the projection Meilisearch adapters write to and the
 * (future) search service reads from. Postgres stays the source of
 * truth; this port models Meilisearch as a disposable, rebuildable
 * projection (PRD §8.6): "every visibility-relevant mutation writes a row
 * to an outbox table ... draining the outbox ... upserting or deleting
 * documents in Meilisearch." Only the port, the document mapper
 * (services/search/map-listing-to-search-document.ts) and the concrete
 * adapter (adapters/meilisearch/) land in this milestone — the outbox
 * drain worker and the public /api/v1/search route that will actually
 * call `search()` are later work; nothing here depends on either
 * existing yet.
 *
 * `ListingSearchDocument` is the exact indexed shape PRD §8.6 names
 * ("id, channel, title, displayAddress, town, outcode, propertyType,
 * bedrooms, bathrooms, price ..., priceQualifier, tenure, furnished,
 * availableFrom, newHome, features, coverImageUrl, imageCount, agency
 * {id, name, logo}, publishedAt, _geo {lat, lng}"). It is never persisted
 * anywhere itself — map-listing-to-search-document.ts rebuilds it fresh
 * from a Listing (+ its images + agency) every time a document needs
 * (re)indexing, the same "pure re-derivation, not a stored list" choice
 * services/images/attach-image-urls.ts makes for variant URLs.
 *
 * `SearchQuery.geo` models the two geo-search paths PRD §8.6 names
 * ("radius search uses `_geoRadius`...; map view uses `_geoBoundingBox`
 * from the visible viewport"). Omitting `geo` entirely is the "no geo
 * constraint" case — deliberately not a third `{ kind: 'none' }` member,
 * since "the field is simply absent" already expresses that without
 * every non-geo caller having to construct a sentinel value.
 */

import type {
  Channel,
  Furnished,
  PriceQualifier,
  PropertyType,
  Tenure,
} from '@/domain/enums'
import type { GeoPoint } from '@/domain/property'

export type { GeoPoint }

export interface ListingSearchAgency {
  id: string
  name: string
  logoUrl: string | null
}

export interface ListingSearchDocument {
  id: string
  channel: Channel
  title: string
  displayAddress: string
  town: string
  outcode: string
  propertyType: PropertyType
  bedrooms: number
  bathrooms: number
  /** Pounds for sale, pcm for rent — see domain/money.ts's convention. */
  price: number
  priceQualifier: PriceQualifier
  /** Sale only; null for rent (mirrors domain/property.ts's
   * PropertyEntity.tenure). */
  tenure: Tenure | null
  /** Rent only; null for sale. */
  furnished: Furnished | null
  /**
   * `YYYY-MM-DD`, or null when the listing has none (every sale listing,
   * and a rent listing with no move-in date set yet). Meilisearch's
   * comparison operators (`<`, `>`, `<=`, `>=`) work lexicographically on
   * strings as well as numerically on numbers, and zero-padded ISO date
   * strings sort identically either way — so `availableFromBefore` (PRD
   * §8.6) filters directly against this string with no separate numeric
   * field needed. Same `YYYY-MM-DD` convention as
   * lib/listing-wizard-form.ts's dateToInputValue.
   */
  availableFrom: string | null
  newHome: boolean
  features: string[]
  /** The position-0 photo's 800w WebP variant URL, or null when the
   * listing has no photos yet (services/search/
   * map-listing-to-search-document.ts). */
  coverImageUrl: string | null
  /** Count of `kind: 'photo'` images only — floorplan/EPC are
   * single-purpose slots, not part of the photo grid (mirrors
   * ports/property-image-repository.ts's countByPropertyAndKind doc
   * comment). */
  imageCount: number
  agency: ListingSearchAgency | null
  /** Unix seconds, for `sortableAttributes` (PRD §8.6) — a plain number
   * sorts correctly regardless of timezone-string formatting, unlike an
   * ISO string. */
  publishedAt: number
  /** Meilisearch's reserved geosearch attribute name — required exactly
   * as `_geo` with `{ lat, lng }` for `_geoRadius`/`_geoBoundingBox` to
   * work (PRD §8.6). */
  _geo: GeoPoint
}

export interface RadiusGeoQuery {
  kind: 'radius'
  lat: number
  lng: number
  radiusMetres: number
}

export interface BoundingBoxGeoQuery {
  kind: 'bbox'
  topRight: GeoPoint
  bottomLeft: GeoPoint
}

export type GeoQuery = RadiusGeoQuery | BoundingBoxGeoQuery

export interface SearchQueryFilters {
  priceMin?: number
  priceMax?: number
  bedroomsMin?: number
  bedroomsMax?: number
  bathroomsMin?: number
  /** Multi-select: matches any of the listed types (OR-within-the-overall
   * AND of filters — PRD §8.6). */
  propertyTypes?: PropertyType[]
  tenure?: Tenure
  furnished?: Furnished
  /** `YYYY-MM-DD` — same format as `ListingSearchDocument.availableFrom`
   * so the two compare directly. */
  availableFromBefore?: string
  newHome?: boolean
  town?: string
  outcode?: string
}

export type SearchSort = 'newest' | 'price_asc' | 'price_desc'

export interface SearchQuery {
  channel: Channel
  geo?: GeoQuery
  filters?: SearchQueryFilters
  /** Defaults to `'newest'` when omitted (adapters/meilisearch's
   * translation). */
  sort?: SearchSort
  /** 1-based — page 1 is the first page. */
  page: number
  /** Defaults to 24 when omitted (adapters/meilisearch's
   * DEFAULT_HITS_PER_PAGE) — a fixed page size, not something the public
   * search UI exposes a control for. */
  hitsPerPage?: number
}

/**
 * Facet counts for the filter badges PRD §8.6 calls for. `propertyType`
 * is always present (a document always has one); the rest are optional
 * because they only make sense, or only get requested, for some queries
 * (`tenure`/`furnished` are channel-specific; `bedrooms` may be omitted
 * from a given search()'s facets request).
 */
export interface SearchFacetCounts {
  propertyType: Record<string, number>
  furnished?: Record<string, number>
  tenure?: Record<string, number>
  bedrooms?: Record<string, number>
}

export interface SearchResult {
  hits: ListingSearchDocument[]
  totalHits: number
  page: number
  totalPages: number
  facets: SearchFacetCounts
}

export interface SearchIndex {
  /** Applies PRD §8.6's filterable/sortable/searchable attribute
   * configuration. Idempotent — safe to call repeatedly (e.g. on every
   * deploy), not just once against a fresh index. */
  ensureSettings(): Promise<void>
  /** Upserts (adds or replaces, keyed on `id`) every document given. */
  upsert(documents: ListingSearchDocument[]): Promise<void>
  delete(ids: string[]): Promise<void>
  search(query: SearchQuery): Promise<SearchResult>
  countDocuments(): Promise<number>
  /** True if the index is reachable and responding — used by the (later)
   * outbox drain worker to skip a run rather than fail it noisily when
   * Meilisearch is briefly unavailable. */
  healthy(): Promise<boolean>
}
