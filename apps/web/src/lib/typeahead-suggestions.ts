/**
 * Merge curated Area rows into geocoder suggestions for the search
 * combobox. Geocode Place/Postcode results are listed as-is; matching
 * AREAS entries are prepended as `kind: 'area'` so Liverpool (and every
 * other curated area) shows an Area badge rather than only a Place.
 */

import { matchCuratedAreasForQuery } from '@/lib/curated-areas'
import type { GeocodeSuggestion } from '@/services/geocoding/search-geocode'

export type AreaTypeaheadSuggestion = {
  kind: 'area'
  slug: string
  label: string
}

export type TypeaheadSuggestion = GeocodeSuggestion | AreaTypeaheadSuggestion

export function mergeTypeaheadSuggestions(
  query: string,
  geocodeResults: GeocodeSuggestion[],
): TypeaheadSuggestion[] {
  const areas: AreaTypeaheadSuggestion[] = matchCuratedAreasForQuery(query).map(
    (area) => ({
      kind: 'area',
      slug: area.slug,
      label: area.label,
    }),
  )
  return [...areas, ...geocodeResults]
}
