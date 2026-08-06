/**
 * GeocodeCache — wraps both halves of Geocoder (ports/geocoder.ts) with a
 * 30-day TTL (PRD §8.6: "Results are cached in Redis for 30 days").
 * services/geocoding/search-geocode.ts is the only caller: it checks the
 * cache before calling PostcodeGeocoder.geocode/PlaceSearcher.searchPlaces,
 * and writes the result back afterwards either way.
 *
 * Postcode and place lookups get separate get/set method pairs rather than
 * one generic `get(key)`/`set(key, value)` pair, because a postcode miss
 * (`null`) and a places miss (`[]`) are both meaningful, distinct
 * *positive* results worth caching in their own right (PRD's "no match
 * for this postcode" is itself useful to remember for 30 days) — a single
 * generic slot would need a runtime-checked union to tell "cached empty
 * array" apart from "cached null" apart from "never looked up", which is
 * more error-prone than two small, precisely-typed method pairs.
 *
 * `undefined` return = cache miss (never looked up, or TTL expired) in
 * every getter — distinct from a cached negative result (`null` for
 * postcodes, `[]` for places), which IS a hit and must short-circuit the
 * real lookup the same as a positive one.
 *
 * Upstash Redis is the PRD-named production backend, landing M4
 * (adapters/upstash/ is still a stub) — adapters/in-memory-geocode-cache.ts
 * implements this port for now, wired at the composition root as a
 * process-lifetime singleton. See that file's doc comment for the
 * consequences of "in-memory" on a serverless deployment.
 */

import type { GeocodeResult, PlaceSuggestion } from './geocoder'

export interface GeocodeCache {
  getPostcode(key: string): Promise<GeocodeResult | null | undefined>
  setPostcode(key: string, result: GeocodeResult | null): Promise<void>
  getPlaces(key: string): Promise<PlaceSuggestion[] | undefined>
  setPlaces(key: string, results: PlaceSuggestion[]): Promise<void>
}
