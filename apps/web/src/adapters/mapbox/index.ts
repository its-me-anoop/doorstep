/**
 * adapters/mapbox/ — implements Geocoder (ports/geocoder.ts) against
 * Mapbox's v5 forward-geocoding endpoint, GB-biased (PRD §8.6: "anything
 * else goes to Mapbox Geocoding with GB bias"; PRD §10 SRCH-1's
 * autocomplete). Both `geocode` and `searchPlaces` call the same
 * endpoint — `geocode` takes the top hit, `searchPlaces` maps every hit
 * and turns `autocomplete=true` on for partial-word matching.
 *
 * **Documented deviation from PRD §8.6**: the PRD names Mapbox Geocoding
 * as *the* free-text provider, with no fallback mentioned. This adapter
 * is wired at the composition root ONLY when MAPBOX_ACCESS_TOKEN is set
 * (see lib/composition.ts) — no token is available in this project's
 * local/CI environments today, so adapters/postcodesio/'s own
 * `searchPlaces` (backed by its free, keyless Places API) is the actual
 * default free-text provider until a Mapbox token is provisioned. This
 * is an accepted, ADR-worthy gap for the docs phase to record formally,
 * not a silent scope cut — every piece of Mapbox-specific code here is
 * real and unit-tested (with a mocked fetch), just not exercised against
 * the live API without a token (tests/integration/mapbox-geocoder.test.ts
 * `skipIf`s exactly that).
 *
 * Lazy env read, mirroring adapters/meilisearch/'s MeilisearchSearchIndex:
 * the constructor never reads MAPBOX_ACCESS_TOKEN itself, so constructing
 * this class (e.g. at the composition root, conditionally) never throws
 * just because the token happens to be unset for a request that doesn't
 * use it — only `geocode`/`searchPlaces` do, via resolveMapboxAccessToken.
 */

import type { Geocoder, GeocodeResult, PlaceSuggestion } from '@/ports/geocoder'

const MAPBOX_GEOCODING_BASE_URL =
  'https://api.mapbox.com/geocoding/v5/mapbox.places'

interface MapboxFeature {
  place_name: string
  text: string
  /** `[longitude, latitude]` — Mapbox's own GeoJSON-style ordering,
   * swapped to this codebase's {lat, lng} convention at the mapping
   * boundary below, nowhere else. */
  center: [number, number]
}

interface MapboxGeocodingResponse {
  features: MapboxFeature[]
}

/** Reads MAPBOX_ACCESS_TOKEN, throwing a message that tells the operator
 * exactly what to set — mirrors adapters/meilisearch/'s
 * resolveMeilisearchHost. */
export function resolveMapboxAccessToken(
  env: Record<string, string | undefined>,
): string {
  const token = env.MAPBOX_ACCESS_TOKEN
  if (!token) {
    throw new Error(
      'MAPBOX_ACCESS_TOKEN is not set. It is required to use MapboxGeocoder ' +
        '— see .env.example. lib/composition.ts only constructs this class ' +
        'when the token is present, so seeing this error means it was ' +
        'constructed some other way.',
    )
  }
  return token
}

function buildUrl(
  query: string,
  token: string,
  extraParams: Record<string, string>,
): string {
  const params = new URLSearchParams({
    access_token: token,
    country: 'gb',
    ...extraParams,
  })
  return `${MAPBOX_GEOCODING_BASE_URL}/${encodeURIComponent(query)}.json?${params.toString()}`
}

function mapFeature(feature: MapboxFeature): PlaceSuggestion {
  const [lng, lat] = feature.center
  return {
    name: feature.text,
    label: feature.place_name,
    lat,
    lng,
    // Mapbox's place features don't carry a UK postal outcode — see this
    // file's header comment.
    outcode: null,
  }
}

export class MapboxGeocoder implements Geocoder {
  private readonly env: Record<string, string | undefined>

  constructor(env: Record<string, string | undefined> = process.env) {
    this.env = env
  }

  async geocode(query: string): Promise<GeocodeResult | null> {
    const trimmed = query.trim()
    if (!trimmed) return null

    const features = await this.fetchFeatures(trimmed, {})
    const top = features[0]
    if (!top) return null

    const suggestion = mapFeature(top)
    return {
      lat: suggestion.lat,
      lng: suggestion.lng,
      label: suggestion.label,
      outcode: suggestion.outcode,
    }
  }

  async searchPlaces(query: string): Promise<PlaceSuggestion[]> {
    const trimmed = query.trim()
    if (!trimmed) return []

    const features = await this.fetchFeatures(trimmed, {
      autocomplete: 'true',
    })
    return features.map(mapFeature)
  }

  private async fetchFeatures(
    query: string,
    extraParams: Record<string, string>,
  ): Promise<MapboxFeature[]> {
    const token = resolveMapboxAccessToken(this.env)
    const response = await fetch(buildUrl(query, token, extraParams))
    if (!response.ok) return []

    const body = (await response.json()) as MapboxGeocodingResponse
    return body.features ?? []
  }
}
