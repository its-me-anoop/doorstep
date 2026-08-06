/**
 * In-memory fakes for services/geocoding/*'s TDD suite (PRD §8.5).
 * FakePostcodeGeocoder/FakePlaceSearcher record the last query they were
 * asked (and how many times) and return whatever a test configured;
 * FakeGeocodeCache is a plain two-Map store with no TTL logic of its own
 * (that behaviour is InMemoryTtlGeocodeCache's, covered by
 * tests/unit/adapters/in-memory-geocode-cache.test.ts) — just enough to
 * prove SearchGeocode reads/writes it correctly.
 */

import type { GeocodeCache } from '@/ports/geocode-cache'
import type {
  GeocodeResult,
  PlaceSearcher,
  PlaceSuggestion,
  PostcodeGeocoder,
} from '@/ports/geocoder'

export class FakePostcodeGeocoder implements PostcodeGeocoder {
  lastQuery: string | null = null
  callCount = 0
  private result: GeocodeResult | null = null

  setResult(result: GeocodeResult | null): void {
    this.result = result
  }

  async geocode(query: string): Promise<GeocodeResult | null> {
    this.lastQuery = query
    this.callCount += 1
    return this.result
  }
}

export class FakePlaceSearcher implements PlaceSearcher {
  lastQuery: string | null = null
  callCount = 0
  private results: PlaceSuggestion[] = []

  setResults(results: PlaceSuggestion[]): void {
    this.results = results
  }

  async searchPlaces(query: string): Promise<PlaceSuggestion[]> {
    this.lastQuery = query
    this.callCount += 1
    return this.results
  }
}

export class FakeGeocodeCache implements GeocodeCache {
  private readonly postcodes = new Map<string, GeocodeResult | null>()
  private readonly places = new Map<string, PlaceSuggestion[]>()

  async getPostcode(key: string): Promise<GeocodeResult | null | undefined> {
    return this.postcodes.has(key) ? this.postcodes.get(key) : undefined
  }

  async setPostcode(key: string, result: GeocodeResult | null): Promise<void> {
    this.postcodes.set(key, result)
  }

  async getPlaces(key: string): Promise<PlaceSuggestion[] | undefined> {
    return this.places.has(key) ? this.places.get(key) : undefined
  }

  async setPlaces(key: string, results: PlaceSuggestion[]): Promise<void> {
    this.places.set(key, results)
  }
}
