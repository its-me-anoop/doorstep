/**
 * SearchListings — the use case behind GET /api/v1/search (PRD §10, §8.6).
 * Public — no session, no actor, mirroring services/geocoding/
 * search-geocode.ts's shape (that file's doc comment explains why: the
 * route itself requires no session, so there is no authz check to make).
 *
 * Two responsibilities, kept in this one class rather than split further
 * (SRP still holds — both steps exist only to serve this one use case,
 * and splitting them would just be indirection with no second caller):
 *
 *  1. Translate the validated public query (lib/validation/search.ts's
 *     SearchQueryInput) into ports/search-index.ts's SearchQuery shape —
 *     radiusMiles -> radiusMetres (domain/distance.ts), the four flat
 *     bbox corners -> GeoQuery's nested topRight/bottomLeft points, and
 *     each filter field renamed to match SearchQueryFilters (beds ->
 *     bedrooms, baths -> bathrooms, types -> propertyTypes, availableBy ->
 *     availableFromBefore).
 *  2. Map each returned ListingSearchDocument to this file's public DTO
 *     (PublicSearchHit) — documented for the Flutter client (PRD §10's
 *     "the single contract the Flutter app will reuse in phase 2").
 *     `displayStatus` is domain/display-status.ts's getDisplayStatus
 *     applied to the document's `status`+`channel` (doc-shape v2 —
 *     ports/search-index.ts's header comment) — since only published/
 *     under_offer listings are ever indexed, this is either the literal
 *     `"published"` or the friendly "Sold STC"/"Let Agreed"/"Sold"/"Let"
 *     label, letting a card badge itself with no extra lookup.
 *
 * Radius default: PRD §8.6 calls for "this-area-only" defaulting to
 * roughly 1 mile when a caller supplies a point but no explicit radius.
 * That default is applied HERE, not in lib/validation/search.ts's schema
 * — see that file's doc comment for why "a validly shaped request" and
 * "what radius a request without one gets" are different concerns.
 *
 * Degradation (PRD §7.6): `SearchIndex.healthy()` is deliberately NOT
 * called before every search — that would add a second Meilisearch round
 * trip to every request, working directly against the "p75 under 500ms"
 * exit criterion (PRD §13's M2 row) for zero behavioural gain: whether
 * checked proactively or not, an unreachable index still fails the same
 * way. Instead, any error `SearchIndex.search` itself throws is treated
 * as an infrastructure failure and wrapped in SearchUnavailableError —
 * the query was built by this class from already-validated input, so a
 * thrown error at this point is Meilisearch being unreachable or
 * misbehaving, not a malformed request. `healthy()` stays on the port for
 * callers that DO want a proactive check outside the request path (e.g. a
 * future admin status page); it is simply not this class's job.
 */

import { getDisplayStatus } from '@/domain/display-status'
import { milesToMetres } from '@/domain/distance'
import type { SearchQueryInput } from '@/lib/validation/search'
import type {
  GeoPoint,
  ListingSearchDocument,
  SearchFacetCounts,
  SearchIndex,
  SearchQuery,
  SearchQueryFilters,
} from '@/ports/search-index'

import { SearchUnavailableError } from './errors'

/** PRD §8.6's "default this-area-only ~1" — applied only when the caller
 * gave a point (lat+lng) but no explicit radiusMiles. */
const DEFAULT_RADIUS_MILES = 1

export interface PublicSearchAgency {
  id: string
  name: string
  logoUrl: string | null
}

export interface PublicSearchHit {
  id: string
  slug: string
  channel: ListingSearchDocument['channel']
  title: string
  displayAddress: string
  town: string
  outcode: string
  propertyType: ListingSearchDocument['propertyType']
  bedrooms: number
  bathrooms: number
  price: number
  priceQualifier: ListingSearchDocument['priceQualifier']
  /** getDisplayStatus(document.status, document.channel) — see this
   * file's header comment. */
  displayStatus: string
  furnished: ListingSearchDocument['furnished']
  availableFrom: string | null
  newHome: boolean
  coverImageUrl: string | null
  imageCount: number
  agency: PublicSearchAgency | null
  publishedAt: number
  geo: GeoPoint
}

export interface PublicSearchResult {
  results: PublicSearchHit[]
  totalCount: number
  page: number
  totalPages: number
  facets: SearchFacetCounts
}

function buildGeo(input: SearchQueryInput): SearchQuery['geo'] {
  if (input.lat !== undefined && input.lng !== undefined) {
    return {
      kind: 'radius',
      lat: input.lat,
      lng: input.lng,
      radiusMetres: milesToMetres(input.radiusMiles ?? DEFAULT_RADIUS_MILES),
    }
  }

  if (
    input.bboxNeLat !== undefined &&
    input.bboxNeLng !== undefined &&
    input.bboxSwLat !== undefined &&
    input.bboxSwLng !== undefined
  ) {
    return {
      kind: 'bbox',
      topRight: { lat: input.bboxNeLat, lng: input.bboxNeLng },
      bottomLeft: { lat: input.bboxSwLat, lng: input.bboxSwLng },
    }
  }

  return undefined
}

function buildFilters(input: SearchQueryInput): SearchQueryFilters {
  return {
    ...(input.priceMin !== undefined ? { priceMin: input.priceMin } : {}),
    ...(input.priceMax !== undefined ? { priceMax: input.priceMax } : {}),
    ...(input.bedsMin !== undefined ? { bedroomsMin: input.bedsMin } : {}),
    ...(input.bedsMax !== undefined ? { bedroomsMax: input.bedsMax } : {}),
    ...(input.bathsMin !== undefined ? { bathroomsMin: input.bathsMin } : {}),
    ...(input.types && input.types.length > 0
      ? { propertyTypes: input.types }
      : {}),
    ...(input.tenure !== undefined ? { tenure: input.tenure } : {}),
    ...(input.furnished !== undefined ? { furnished: input.furnished } : {}),
    ...(input.availableBy !== undefined
      ? { availableFromBefore: input.availableBy }
      : {}),
    ...(input.newHome !== undefined ? { newHome: input.newHome } : {}),
    ...(input.town !== undefined ? { town: input.town } : {}),
    ...(input.outcode !== undefined ? { outcode: input.outcode } : {}),
  }
}

function toSearchQuery(input: SearchQueryInput): SearchQuery {
  return {
    channel: input.channel,
    geo: buildGeo(input),
    filters: buildFilters(input),
    sort: input.sort,
    page: input.page,
  }
}

function toPublicAgency(
  agency: ListingSearchDocument['agency'],
): PublicSearchAgency | null {
  if (!agency) return null
  return { id: agency.id, name: agency.name, logoUrl: agency.logoUrl }
}

function toPublicHit(document: ListingSearchDocument): PublicSearchHit {
  return {
    id: document.id,
    slug: document.slug,
    channel: document.channel,
    title: document.title,
    displayAddress: document.displayAddress,
    town: document.town,
    outcode: document.outcode,
    propertyType: document.propertyType,
    bedrooms: document.bedrooms,
    bathrooms: document.bathrooms,
    price: document.price,
    priceQualifier: document.priceQualifier,
    displayStatus: getDisplayStatus(document.status, document.channel),
    furnished: document.furnished,
    availableFrom: document.availableFrom,
    newHome: document.newHome,
    coverImageUrl: document.coverImageUrl,
    imageCount: document.imageCount,
    agency: toPublicAgency(document.agency),
    publishedAt: document.publishedAt,
    geo: document._geo,
  }
}

export class SearchListings {
  constructor(private readonly searchIndex: SearchIndex) {}

  async execute(input: SearchQueryInput): Promise<PublicSearchResult> {
    const query = toSearchQuery(input)

    let result
    try {
      result = await this.searchIndex.search(query)
    } catch (error) {
      throw new SearchUnavailableError(error)
    }

    return {
      results: result.hits.map(toPublicHit),
      totalCount: result.totalHits,
      page: result.page,
      totalPages: result.totalPages,
      facets: result.facets,
    }
  }
}
