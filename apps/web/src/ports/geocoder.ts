/**
 * Geocoder — UK postcode lookups route to postcodes.io; everything else
 * to Mapbox Geocoding with GB bias. Callers do not need to know which
 * provider handled a given query. See PRD §8.6.
 */

export interface GeocodeResult {
  lat: number
  lng: number
  label: string
  outcode: string | null
}

export interface Geocoder {
  geocode(query: string): Promise<GeocodeResult | null>
}
