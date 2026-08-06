/**
 * Where selecting a search-combobox suggestion navigates
 * (M2-DESIGN-SPEC.md §1.9). Pure and separately testable from the
 * combobox component itself, which only needs to call this once on
 * selection.
 */

import type { Channel } from '@/domain/enums'
import { matchCuratedArea } from '@/lib/curated-areas'
import { buildSearchHref, type SearchUrlState } from '@/lib/search-url'
import type { GeocodeSuggestion } from '@/services/geocoding/search-geocode'

/** Postcode fast-path results are precise; place-name results are
 * fuzzier and benefit from a wider net (§1.7's radius default table). */
const DEFAULT_RADIUS_MILES: Record<GeocodeSuggestion['kind'], number> = {
  postcode: 3,
  place: 5,
}

function channelPrefix(channel: Channel): string {
  return channel === 'sale' ? '/for-sale' : '/to-rent'
}

export function hrefForGeocodeSuggestion(
  suggestion: GeocodeSuggestion,
  channel: Channel,
): string {
  const matchText =
    suggestion.kind === 'place' ? suggestion.name : suggestion.label
  const area = matchCuratedArea(matchText)
  if (area) {
    return `${channelPrefix(channel)}/${area.slug}`
  }

  const state: SearchUrlState = {
    lat: suggestion.lat,
    lng: suggestion.lng,
    radius: DEFAULT_RADIUS_MILES[suggestion.kind],
    label: suggestion.label,
  }
  return buildSearchHref(`${channelPrefix(channel)}/search`, state)
}
