/**
 * Where selecting a search-combobox suggestion navigates
 * (M2-DESIGN-SPEC.md §1.9). Pure and separately testable from the
 * combobox component itself, which only needs to call this once on
 * selection.
 */

import type { Channel } from '@/domain/enums'
import { matchCuratedArea } from '@/lib/curated-areas'
import { buildSearchHref, type SearchUrlState } from '@/lib/search-url'
import type { TypeaheadSuggestion } from '@/lib/typeahead-suggestions'
import type { GeocodeSuggestion } from '@/services/geocoding/search-geocode'

/** Postcode fast-path results are precise; place-name results are
 * fuzzier and benefit from a wider net (§1.7's radius default table). */
const DEFAULT_RADIUS_MILES: Record<GeocodeSuggestion['kind'], number> = {
  postcode: 3,
  place: 5,
}

export function channelPrefix(channel: Channel): string {
  return channel === 'sale' ? '/for-sale' : '/to-rent'
}

/** Where a suggestion lands, split into the route (`basePath`) and the
 * location part of the URL state — so a caller that wants to *add*
 * filters to the location (lib/nl-search/navigation.ts) can merge into
 * `state` before serialising, instead of re-parsing an href. */
export interface GeocodeSearchTarget {
  basePath: string
  state: SearchUrlState
}

export function searchTargetForGeocodeSuggestion(
  suggestion: TypeaheadSuggestion,
  channel: Channel,
): GeocodeSearchTarget {
  if (suggestion.kind === 'area') {
    return {
      basePath: `${channelPrefix(channel)}/${suggestion.slug}`,
      state: {},
    }
  }

  const matchText =
    suggestion.kind === 'place' ? suggestion.name : suggestion.label
  const area = matchCuratedArea(matchText)
  if (area) {
    return { basePath: `${channelPrefix(channel)}/${area.slug}`, state: {} }
  }

  return {
    basePath: `${channelPrefix(channel)}/search`,
    state: {
      lat: suggestion.lat,
      lng: suggestion.lng,
      radius: DEFAULT_RADIUS_MILES[suggestion.kind],
      label: suggestion.label,
    },
  }
}

export function hrefForGeocodeSuggestion(
  suggestion: TypeaheadSuggestion,
  channel: Channel,
): string {
  const target = searchTargetForGeocodeSuggestion(suggestion, channel)
  return buildSearchHref(target.basePath, target.state)
}
