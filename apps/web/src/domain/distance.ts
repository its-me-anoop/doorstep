/**
 * Distance conversion. The one caller today is services/search/
 * search-listings.ts translating a public radiusMiles query param into the
 * metres ports/search-index.ts's RadiusGeoQuery (and, ultimately,
 * Meilisearch's `_geoRadius`, PRD §8.6) expects.
 */

/** The international mile, exactly 1609.344 metres (the 1959 international
 * yard-and-pound agreement's definition) — not an approximation. */
const METRES_PER_MILE = 1609.344

export function milesToMetres(miles: number): number {
  return miles * METRES_PER_MILE
}
