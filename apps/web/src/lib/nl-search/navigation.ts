/**
 * Where a plain-English search navigates. Pure: takes the parser's
 * output (lib/nl-search/parse.ts), the channel it resolved to, an
 * optional geocoded suggestion for the parsed place, and — on a results
 * page — the page's current state, and returns the same `{ basePath,
 * state }` shape `searchTargetForGeocodeSuggestion` does, ready for
 * `buildSearchHref`.
 *
 * Deliberately built *out of* the existing URL helpers rather than
 * beside them: the place → route decision is `searchTargetForGeocode-
 * Suggestion` (curated area page vs `/search` point tier, §1.7/§1.9), a
 * channel change is `resetStateForChannelSwitch` (§3.2's reset rule),
 * and serialisation is `buildSearchHref`. This module only decides how
 * to *layer* the parsed filters on top — so a plain-English search can
 * never produce a URL the ordinary filter bar couldn't have.
 */

import type { Channel } from '@/domain/enums'
import {
  channelPrefix,
  searchTargetForGeocodeSuggestion,
} from '@/lib/geocode-navigation'
import type { NlSearchFilters } from '@/lib/nl-search/parse'
import {
  buildSearchHref,
  resetStateForChannelSwitch,
  type SearchUrlState,
} from '@/lib/search-url'
import type { TypeaheadSuggestion } from '@/lib/typeahead-suggestions'

export interface NlSearchTarget {
  basePath: string
  state: SearchUrlState
}

/** A results page's own identity, for the "refine what I'm already
 * looking at" mode (the same three values ResultsView already holds). */
export interface CurrentSearchContext {
  channel: Channel
  basePath: string
  state: SearchUrlState
}

export interface BuildNlSearchTargetInput {
  /** The parsed filters to apply — after the UI has removed any chip
   * the visitor dismissed. */
  filters: NlSearchFilters
  /** The channel the search should run on: the parser's explicit cue if
   * it found one, else whatever the visitor already had selected. */
  channel: Channel
  /** The geocoded resolution of the parsed place, if there was a place
   * *and* it resolved. `undefined`/`null` both mean "no new location":
   * a results page keeps the one it has, the hero searches the
   * channel's unrestricted tier. */
  suggestion?: TypeaheadSuggestion | null
  current?: CurrentSearchContext
}

function otherChannelBasePath(basePath: string, channel: Channel): string {
  return basePath.replace(/^\/(for-sale|to-rent)/, channelPrefix(channel))
}

const LOCATION_FIELDS = [
  'lat',
  'lng',
  'radius',
  'label',
  'bboxNeLat',
  'bboxNeLng',
  'bboxSwLat',
  'bboxSwLng',
] as const satisfies readonly (keyof SearchUrlState)[]

function withoutLocation(state: SearchUrlState): SearchUrlState {
  const next: SearchUrlState = { ...state }
  for (const field of LOCATION_FIELDS) delete next[field]
  return next
}

export function buildNaturalLanguageSearchTarget({
  filters,
  channel,
  suggestion,
  current,
}: BuildNlSearchTargetInput): NlSearchTarget {
  // 1. Start from what the visitor is already looking at (a results
  //    page), applying the channel-switch reset rule if the sentence
  //    moved them between Buy and Rent; or from nothing (the hero).
  let basePath: string
  let state: SearchUrlState
  if (current) {
    const switched = current.channel !== channel
    state = switched
      ? resetStateForChannelSwitch(current.state)
      : { ...current.state }
    basePath = switched
      ? otherChannelBasePath(current.basePath, channel)
      : current.basePath
  } else {
    state = {}
    basePath = channelPrefix(channel)
  }

  // 2. A resolved place replaces the location wholesale — area page,
  //    `/search` point tier, or nothing new.
  if (suggestion) {
    const target = searchTargetForGeocodeSuggestion(suggestion, channel)
    basePath = target.basePath
    state = { ...withoutLocation(state), ...target.state }
  }

  // 3. Layer the parsed filters on. `radius` only means something with a
  //    point to measure from — it never applies to an area page or the
  //    unrestricted tier, and it never overrides a bbox.
  const { radius, ...rest } = filters
  for (const [key, value] of Object.entries(rest)) {
    if (value !== undefined) {
      ;(state as Record<string, unknown>)[key] = value
    }
  }
  if (
    radius !== undefined &&
    state.lat !== undefined &&
    state.lng !== undefined
  ) {
    state.radius = radius
  }

  // A new search always starts on page 1.
  delete state.page

  return { basePath, state }
}

export function hrefForNaturalLanguageSearch(
  input: BuildNlSearchTargetInput,
): string {
  const target = buildNaturalLanguageSearchTarget(input)
  return buildSearchHref(target.basePath, target.state)
}
