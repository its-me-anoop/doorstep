/**
 * In-memory fake for services/geocoding/*'s TDD suite (PRD §8.5). Unlike
 * FakeListingRepository (tests/unit/services/listings/fakes.ts), there is
 * only one method to fake — this just records the last query it was
 * asked and returns whatever result a test configured, or null.
 */

import type { GeocodeResult, Geocoder } from '@/ports/geocoder'

export class FakeGeocoder implements Geocoder {
  lastQuery: string | null = null
  private result: GeocodeResult | null = null

  /** Configures the result the next `geocode` call resolves with. */
  setResult(result: GeocodeResult | null): void {
    this.result = result
  }

  async geocode(query: string): Promise<GeocodeResult | null> {
    this.lastQuery = query
    return this.result
  }
}
