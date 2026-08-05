/**
 * SearchGeocode — the use case behind GET /api/v1/geocode?q= (PRD §10:
 * "Suggestions: postcode fast-path + Mapbox place results"; PRD §8.6).
 * Public — unlike every services/listings/* use case, there is no actor
 * and no authz check, because the route itself requires no session.
 *
 * Deliberately thin: the actual postcode/outcode recognition lives in
 * adapters/postcodesio/ (the only Geocoder implementation composition.ts
 * wires in for M1); this class exists so the route calls a service, not
 * an adapter, matching every other route in this API (PRD §8.5) and
 * keeping the route unit-testable via the same mocked-composition pattern
 * the other listings routes use. `execute` returns an array rather than
 * Geocoder's own `| null` because the route's response shape is always
 * `{ data: { results: [] } }` (PRD §8.6's "Suggestions" plural — Mapbox
 * place search in M2 will return more than one) — wrapping happens once,
 * here, rather than in the route.
 */

import type { GeocodeResult, Geocoder } from '@/ports/geocoder'

export class SearchGeocode {
  constructor(private readonly geocoder: Geocoder) {}

  async execute(query: string): Promise<GeocodeResult[]> {
    const result = await this.geocoder.geocode(query)
    return result ? [result] : []
  }
}
