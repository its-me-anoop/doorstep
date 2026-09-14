/**
 * The "show what we understood before applying it" step of plain-English
 * search: turns a parse (+ any on-device suggestions) into a list of
 * dismissible chips, and turns the chips the visitor kept back into the
 * filters to actually apply. Pure, so the component
 * (components/features/search/plain-english/plain-english-search.tsx) is only wiring.
 *
 * One chip per *facet* (price, beds, type...), mirroring
 * components/features/search/filter-chips.tsx's read-out of an active
 * query — dismissing "Up to £350,000" drops both price bounds together,
 * the same way that component's price chip removes both.
 */

import type { Channel, PropertyType } from '@/domain/enums'
import {
  FURNISHED_LABELS,
  PROPERTY_TYPE_LABELS,
} from '@/components/features/listings/wizard/wizard-labels'
import { formatIsoDateLong } from '@/lib/format-date'
import type { NlSearchFilters, NlSearchParse } from '@/lib/nl-search/parse'
import type { SemanticHint } from '@/lib/nl-search/semantic-hints'
import type { SearchSort } from '@/lib/search-url'

export type NlChipFacet =
  | 'channel'
  | 'place'
  | 'radius'
  | 'beds'
  | 'price'
  | 'type'
  | 'furnished'
  | 'availableFrom'
  | 'sort'
  | 'view'

export interface NlChip {
  facet: NlChipFacet
  label: string
  /** `parsed` — a rule matched the visitor's own words; `suggested` —
   * the on-device model inferred it from words no rule understood, so
   * the UI marks it as a suggestion. */
  source: 'parsed' | 'suggested'
  /** For a suggestion, the fragment it was inferred from. */
  because?: string
}

export interface NlSearchReadout {
  chips: NlChip[]
  /** Every wish the product has no filter for yet — rule-based first,
   * then any the model inferred (marked `suggested`). */
  unsupported: { label: string; source: 'parsed' | 'suggested' }[]
  /** The channel the search will actually run on. */
  channel: Channel
  /** The filters to apply after dismissals. */
  filters: NlSearchFilters
}

const CHANNEL_CHIP_LABEL: Record<Channel, string> = {
  sale: 'For sale',
  rent: 'To rent',
}

const SORT_CHIP_LABEL: Record<SearchSort, string> = {
  newest: 'Newest first',
  price_asc: 'Cheapest first',
  price_desc: 'Most expensive first',
}

function formatPounds(value: number, channel: Channel): string {
  const base = `£${value.toLocaleString('en-GB')}`
  return channel === 'rent' ? `${base} pcm` : base
}

function priceLabel(
  min: number | undefined,
  max: number | undefined,
  channel: Channel,
): string {
  if (min !== undefined && max !== undefined) {
    return `${formatPounds(min, channel)}–${formatPounds(max, channel)}`
  }
  if (min !== undefined) return `From ${formatPounds(min, channel)}`
  return `Up to ${formatPounds(max as number, channel)}`
}

function bedsWord(value: number): string {
  if (value === 0) return 'Studio'
  if (value === 6) return '6+ beds'
  return `${value} ${value === 1 ? 'bed' : 'beds'}`
}

function bedsLabel(min: number | undefined, max: number | undefined): string {
  if (min !== undefined && max !== undefined) {
    if (min === max) return bedsWord(min)
    return `${bedsWord(min)}–${bedsWord(max)}`
  }
  if (min !== undefined) return min === 0 ? 'Studio+' : `${min}+ beds`
  return `Up to ${bedsWord(max as number)}`
}

/** Three or more house types read as a single "House" — that's how the
 * parser encodes the word "house" (detached + semi + terraced). */
function typeLabel(types: readonly PropertyType[]): string {
  const houseTypes: PropertyType[] = ['detached', 'semi_detached', 'terraced']
  const isHouse = houseTypes.every((type) => types.includes(type))
  const rest = isHouse
    ? types.filter((type) => !houseTypes.includes(type))
    : [...types]
  const labels = [
    ...(isHouse ? ['House'] : []),
    ...rest.map((type) => PROPERTY_TYPE_LABELS[type]),
  ]
  if (labels.length <= 2) return labels.join(' or ')
  return `${labels.length} property types`
}

export interface BuildReadoutInput {
  parse: NlSearchParse
  /** The channel the visitor already has selected (hero toggle or the
   * results page's own), used when the sentence carries no cue. */
  fallbackChannel: Channel
  hints?: readonly SemanticHint[]
  /** Facets whose chip the visitor has dismissed. */
  dismissed?: ReadonlySet<NlChipFacet>
}

export function buildNlSearchReadout({
  parse,
  fallbackChannel,
  hints = [],
  dismissed = new Set(),
}: BuildReadoutInput): NlSearchReadout {
  const chips: NlChip[] = []
  const filters: NlSearchFilters = {}
  const keep = (facet: NlChipFacet) => !dismissed.has(facet)

  const channel =
    parse.channel && keep('channel') ? parse.channel : fallbackChannel
  if (parse.channel) {
    chips.push({
      facet: 'channel',
      label: CHANNEL_CHIP_LABEL[parse.channel],
      source: 'parsed',
    })
  }

  if (parse.place) {
    chips.push({ facet: 'place', label: parse.place, source: 'parsed' })
  }

  const { filters: parsed } = parse

  if (parsed.radius !== undefined) {
    chips.push({
      facet: 'radius',
      label: `Within ${parsed.radius} ${parsed.radius === 1 ? 'mile' : 'miles'}`,
      source: 'parsed',
    })
    if (keep('radius')) filters.radius = parsed.radius
  }

  if (parsed.minBeds !== undefined || parsed.maxBeds !== undefined) {
    chips.push({
      facet: 'beds',
      label: bedsLabel(parsed.minBeds, parsed.maxBeds),
      source: 'parsed',
    })
    if (keep('beds')) {
      if (parsed.minBeds !== undefined) filters.minBeds = parsed.minBeds
      if (parsed.maxBeds !== undefined) filters.maxBeds = parsed.maxBeds
    }
  }

  if (parsed.minPrice !== undefined || parsed.maxPrice !== undefined) {
    chips.push({
      facet: 'price',
      label: priceLabel(parsed.minPrice, parsed.maxPrice, channel),
      source: 'parsed',
    })
    if (keep('price')) {
      if (parsed.minPrice !== undefined) filters.minPrice = parsed.minPrice
      if (parsed.maxPrice !== undefined) filters.maxPrice = parsed.maxPrice
    }
  }

  // A type the rules found always wins over a suggestion; the model only
  // gets a say when no rule matched a type at all.
  const typeHint = parsed.type
    ? undefined
    : hints.find(
        (hint): hint is Extract<SemanticHint, { kind: 'type' }> =>
          hint.kind === 'type',
      )
  if (parsed.type && parsed.type.length > 0) {
    chips.push({
      facet: 'type',
      label: typeLabel(parsed.type),
      source: 'parsed',
    })
    if (keep('type')) filters.type = parsed.type
  } else if (typeHint) {
    chips.push({
      facet: 'type',
      label: typeLabel(typeHint.types),
      source: 'suggested',
      because: typeHint.phrase,
    })
    if (keep('type')) filters.type = [...typeHint.types].sort()
  }

  if (parsed.furnished && parsed.furnished.length > 0) {
    chips.push({
      facet: 'furnished',
      label: parsed.furnished
        .map((value) => FURNISHED_LABELS[value])
        .join(' or '),
      source: 'parsed',
    })
    if (keep('furnished')) filters.furnished = parsed.furnished
  }

  if (parsed.availableFrom) {
    chips.push({
      facet: 'availableFrom',
      label: `Available by ${formatIsoDateLong(parsed.availableFrom)}`,
      source: 'parsed',
    })
    if (keep('availableFrom')) filters.availableFrom = parsed.availableFrom
  }

  if (parsed.sort) {
    chips.push({
      facet: 'sort',
      label: SORT_CHIP_LABEL[parsed.sort],
      source: 'parsed',
    })
    if (keep('sort')) filters.sort = parsed.sort
  }

  if (parsed.view === 'map') {
    chips.push({ facet: 'view', label: 'Map view', source: 'parsed' })
    if (keep('view')) filters.view = 'map'
  }

  const unsupported: NlSearchReadout['unsupported'] = parse.unsupported.map(
    (label) => ({ label, source: 'parsed' as const }),
  )
  for (const hint of hints) {
    if (hint.kind !== 'unsupported') continue
    if (unsupported.some((entry) => entry.label === hint.label)) continue
    unsupported.push({ label: hint.label, source: 'suggested' })
  }

  return { chips, unsupported, channel, filters }
}
