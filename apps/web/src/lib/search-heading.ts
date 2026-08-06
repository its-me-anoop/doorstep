/**
 * Builds the results page `<h1>` from the active filters
 * (M2-DESIGN-SPEC.md §3.1 point 2) — always an honest, specific
 * description of what's being shown, never a static string. Only the
 * `unrestricted` and `search` tiers are modelled here; the `area` tier
 * (§4, "Homes for sale in Reading") is out of scope for this
 * milestone's routes and would add a third `tier` case + the
 * town/outcode area-label lookup when it lands.
 */

import type { Channel } from '@/domain/enums'
import type { SearchUrlState } from '@/lib/search-url'

export type SearchHeadingTier = 'unrestricted' | 'search'

interface BuildSearchHeadingInput {
  channel: Channel
  state: SearchUrlState
  tier: SearchHeadingTier
}

const UNRESTRICTED_AREA_LABEL = 'Reading & the Thames Valley'

const CHANNEL_VERB: Record<Channel, string> = {
  sale: 'for sale',
  rent: 'to rent',
}

/** Plural, sentence-ready labels — distinct from
 * wizard-labels.ts's `PROPERTY_TYPE_LABELS` (singular, form-field copy:
 * "Flat or apartment"). The heading needs "Flats," matching the spec's
 * own worked examples. */
const PROPERTY_TYPE_PLURAL_LABELS: Record<string, string> = {
  detached: 'Detached houses',
  semi_detached: 'Semi-detached houses',
  terraced: 'Terraced houses',
  flat: 'Flats',
  bungalow: 'Bungalows',
  maisonette: 'Maisonettes',
  land: 'Land',
  other: 'Other properties',
}

function subjectWord(state: SearchUrlState): string {
  if (state.type && state.type.length === 1) {
    return PROPERTY_TYPE_PLURAL_LABELS[state.type[0]] ?? 'Homes'
  }
  return 'Homes'
}

function capitalise(text: string): string {
  return text.charAt(0).toUpperCase() + text.slice(1)
}

export function buildSearchHeading({
  channel,
  state,
  tier,
}: BuildSearchHeadingInput): string {
  const subject = subjectWord(state)
  const bedsPrefix = state.minBeds !== undefined ? `${state.minBeds}-bed ` : ''
  // A beds prefix makes the subject word mid-sentence, so it's lowercase
  // there; capitalise() then re-capitalises whatever ends up first.
  const words = `${bedsPrefix}${bedsPrefix ? subject.toLowerCase() : subject}`

  const area = tier === 'search' ? (state.label ?? '') : UNRESTRICTED_AREA_LABEL
  const preposition = tier === 'search' ? 'near' : 'in'

  return capitalise(`${words} ${CHANNEL_VERB[channel]} ${preposition} ${area}`)
}
