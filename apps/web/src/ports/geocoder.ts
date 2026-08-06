/**
 * Geocoder — UK postcode lookups route to postcodes.io; free-text place
 * names route to Mapbox Geocoding with GB bias when configured, falling
 * back to postcodes.io's own Places API otherwise. Callers do not need to
 * know which provider handled a given query. See PRD §8.6, §10 (SRCH-1).
 *
 * Split per ISP, mirroring ports/listing-repository.ts's
 * ListingReader/ListingWriter: services/geocoding/search-geocode.ts's
 * postcode fast path only ever needs `PostcodeGeocoder`, and its place
 * fallback only ever needs `PlaceSearcher` — each is wired to a
 * (possibly different) adapter instance at the composition root, so
 * neither dependency should be forced to depend on a method it never
 * calls. `Geocoder` (both capabilities combined) is what a single
 * adapter — PostcodesIoGeocoder, MapboxGeocoder — implements; LSP holds
 * because both pass the same contract expectations for each method in
 * isolation.
 */

export interface GeocodeResult {
  lat: number
  lng: number
  label: string
  outcode: string | null
}

/**
 * One free-text place suggestion (PRD §10 SRCH-1's "{name, label, lat,
 * lng, outcode?}"). `name` is the place's own name (e.g. "Reading");
 * `label` is the fuller, disambiguating description (e.g. "Reading,
 * Berkshire, England") — both are shown together in an autocomplete list
 * the same way most UK property portals present them. `outcode` is
 * `null` whenever the provider's result doesn't resolve to a specific UK
 * postal outcode (most places don't have one single outcode covering
 * them), not an error case.
 */
export interface PlaceSuggestion {
  name: string
  label: string
  lat: number
  lng: number
  outcode: string | null
}

export interface PostcodeGeocoder {
  /** Resolves a full or partial (outcode-only) UK postcode to its
   * coordinates, or `null` if `query` isn't recognisable as one at all —
   * see adapters/postcodesio/'s doc comment for the exact matching
   * rules. */
  geocode(query: string): Promise<GeocodeResult | null>
}

export interface PlaceSearcher {
  /** Free-text place-name autocomplete, GB-biased. Returns an empty array
   * (never throws for "no matches") when nothing resembles `query`. */
  searchPlaces(query: string): Promise<PlaceSuggestion[]>
}

export interface Geocoder extends PostcodeGeocoder, PlaceSearcher {}
