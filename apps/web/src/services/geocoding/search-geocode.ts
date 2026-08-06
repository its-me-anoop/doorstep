/**
 * SearchGeocode — the use case behind GET /api/v1/geocode?q= (PRD §10
 * SRCH-1: "Suggestions: postcode fast-path + Mapbox place results"; PRD
 * §8.6). Public — like every services/geocoding/* use case, there is no
 * actor and no authz check, because the route itself requires no
 * session.
 *
 * "Postcode fast-path hits first, else places" (PRD §10): a query that
 * resolves via `postcodeGeocoder` short-circuits to that single, precise
 * result; only when it doesn't does this fall through to `placeSearcher`'s
 * (possibly several) free-text suggestions. `GeocodeSuggestion`'s `kind`
 * discriminant tags which path produced each result — this is the
 * doc-shape version bump GET /api/v1/geocode's route wraps as
 * `{ data: { version: 2, results } }`, replacing M1's bare, undiscriminated
 * `GeocodeResult[]`.
 *
 * Both paths are wrapped in `geocodeCache` (PRD §8.6: "cached in Redis for
 * 30 days" — InMemoryTtlGeocodeCache stands in until M4). The cache key is
 * the query trimmed and lowercased, so "RG30 1AA" and " rg30 1aa " share
 * one entry; `postcodeGeocoder`/`placeSearcher` themselves always see the
 * caller's original, unmodified query — normalisation is a caching
 * concern only, not something either dependency should have to redo
 * itself. A postcode MISS (`null`) is cached exactly like a hit: re-
 * resolving "is this even shaped like a postcode" is cheap, but the
 * point of caching is consistency of behaviour across both branches, not
 * a network-cost judgement call per query shape.
 */

import type { GeocodeCache } from '@/ports/geocode-cache'
import type { PlaceSearcher, PostcodeGeocoder } from '@/ports/geocoder'

export type GeocodeSuggestion =
  | {
      kind: 'postcode'
      label: string
      lat: number
      lng: number
      outcode: string | null
    }
  | {
      kind: 'place'
      name: string
      label: string
      lat: number
      lng: number
      outcode: string | null
    }

function cacheKey(query: string): string {
  return query.trim().toLowerCase()
}

export class SearchGeocode {
  constructor(
    private readonly postcodeGeocoder: PostcodeGeocoder,
    private readonly placeSearcher: PlaceSearcher,
    private readonly geocodeCache: GeocodeCache,
  ) {}

  async execute(query: string): Promise<GeocodeSuggestion[]> {
    const key = cacheKey(query)

    const postcodeResult = await this.resolvePostcode(query, key)
    if (postcodeResult) {
      return [
        {
          kind: 'postcode',
          label: postcodeResult.label,
          lat: postcodeResult.lat,
          lng: postcodeResult.lng,
          outcode: postcodeResult.outcode,
        },
      ]
    }

    const places = await this.resolvePlaces(query, key)
    return places.map((place) => ({
      kind: 'place' as const,
      name: place.name,
      label: place.label,
      lat: place.lat,
      lng: place.lng,
      outcode: place.outcode,
    }))
  }

  private async resolvePostcode(query: string, key: string) {
    const cached = await this.geocodeCache.getPostcode(key)
    if (cached !== undefined) return cached

    const result = await this.postcodeGeocoder.geocode(query)
    await this.geocodeCache.setPostcode(key, result)
    return result
  }

  private async resolvePlaces(query: string, key: string) {
    const cached = await this.geocodeCache.getPlaces(key)
    if (cached !== undefined) return cached

    const results = await this.placeSearcher.searchPlaces(query)
    await this.geocodeCache.setPlaces(key, results)
    return results
  }
}
