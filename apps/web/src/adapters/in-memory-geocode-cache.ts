/**
 * InMemoryTtlGeocodeCache — implements GeocodeCache (ports/geocode-cache.ts)
 * as two plain Maps, keyed by an exact-match string (the caller
 * normalises — see services/geocoding/search-geocode.ts). Stands in for
 * Upstash Redis until M4 (PRD §8.6's 30-day cache lands on real Redis
 * then; adapters/upstash/ is still a stub) — see that port's doc comment
 * for why postcode/places get separate Maps rather than one generic one.
 *
 * Deliberately process-lifetime, not per-request: lib/composition.ts
 * constructs exactly one instance at module scope (mirroring
 * adapters/drizzle/client.ts's `getDb()` singleton), not one per
 * `createServices()` call, so entries actually survive across requests
 * within one warm server process. This is real caching benefit on a
 * long-lived Node server, and a much weaker one on Vercel's serverless
 * functions specifically (a cold start gets an empty cache; a scaled-out
 * second instance doesn't share this one's entries at all) — an
 * accepted, documented gap that Upstash Redis (a real shared store)
 * closes in M4, not a defect in this adapter.
 */

import type { Clock } from '@/ports/clock'
import type { GeocodeCache } from '@/ports/geocode-cache'
import type { GeocodeResult, PlaceSuggestion } from '@/ports/geocoder'

/** PRD §8.6: "Results are cached in Redis for 30 days." */
const TTL_MS = 30 * 24 * 60 * 60 * 1000

interface CacheEntry<T> {
  value: T
  expiresAt: number
}

export class InMemoryTtlGeocodeCache implements GeocodeCache {
  private readonly postcodes = new Map<
    string,
    CacheEntry<GeocodeResult | null>
  >()
  private readonly places = new Map<string, CacheEntry<PlaceSuggestion[]>>()

  constructor(private readonly clock: Clock) {}

  async getPostcode(key: string): Promise<GeocodeResult | null | undefined> {
    return this.read(this.postcodes, key)
  }

  async setPostcode(key: string, result: GeocodeResult | null): Promise<void> {
    this.write(this.postcodes, key, result)
  }

  async getPlaces(key: string): Promise<PlaceSuggestion[] | undefined> {
    return this.read(this.places, key)
  }

  async setPlaces(key: string, results: PlaceSuggestion[]): Promise<void> {
    this.write(this.places, key, results)
  }

  private read<T>(
    store: Map<string, CacheEntry<T>>,
    key: string,
  ): T | undefined {
    const entry = store.get(key)
    if (!entry) return undefined
    if (entry.expiresAt <= this.clock.now().getTime()) {
      store.delete(key)
      return undefined
    }
    return entry.value
  }

  private write<T>(
    store: Map<string, CacheEntry<T>>,
    key: string,
    value: T,
  ): void {
    store.set(key, { value, expiresAt: this.clock.now().getTime() + TTL_MS })
  }
}
