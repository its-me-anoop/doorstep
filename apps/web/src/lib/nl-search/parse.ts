/**
 * Plain-English search → structured search state. The deterministic
 * core of the "Ask in plain English" feature: a rule-based natural-
 * language parser tuned to how UK buyers and renters actually phrase a
 * property search ("2 bed flat in Reading under £350k with parking",
 * "unfurnished 3 bed house to rent in RG4 for around £1,800 pcm from
 * October").
 *
 * Design rules:
 *
 *  - **Pure, synchronous, no network.** Runs identically in the browser
 *    (live as the visitor types), in a Node unit test, and on the server
 *    if ever needed. The on-device ML layer (`semantic-hints.ts`) sits
 *    *on top* of this, never instead of it — if WebAssembly is
 *    unavailable or the model never loads, this parser alone is the
 *    feature.
 *  - **Emits the existing vocabulary, never a parallel one.** `filters`
 *    is a `SearchUrlState` subset (lib/search-url.ts) so it can be merged
 *    into a page's current state and serialised with `buildSearchHref`.
 *    Location is deliberately *not* resolved here — `place` is free text
 *    for the caller to geocode through the existing `/api/v1/geocode`
 *    route (lib/nl-search/navigation.ts).
 *  - **Honest about what it can't do.** A wish the product has no filter
 *    for yet (parking, garden, pets, a bathroom count) is surfaced in
 *    `unsupported` so the UI can say so, rather than silently dropped or
 *    faked as some approximate filter.
 *  - **Consume-as-you-go.** Each recogniser blanks the span it matched
 *    (replacing it with a non-word sentinel so later regexes can't see
 *    across it), so nothing is double-counted and whatever survives every
 *    recogniser is genuinely unexplained text (`residual`) — the input to
 *    the place fallback and to the semantic layer.
 */

import type { Channel, Furnished, PropertyType } from '@/domain/enums'
import { matchCuratedArea } from '@/lib/curated-areas'
import {
  SEARCH_RADIUS_MILES_OPTIONS,
  type SearchUrlState,
} from '@/lib/search-url'

/** The `SearchUrlState` fields this parser can populate — everything
 * except location (`lat`/`lng`/`label`/bbox), which needs a geocoder,
 * and `page`, which a fresh search always resets. */
export type NlSearchFilters = Pick<
  SearchUrlState,
  | 'minPrice'
  | 'maxPrice'
  | 'minBeds'
  | 'maxBeds'
  | 'type'
  | 'furnished'
  | 'availableFrom'
  | 'sort'
  | 'view'
  | 'radius'
>

export interface NlSearchParse {
  /** An explicit buy/rent cue ("to rent", "for sale", "pcm"...).
   * `undefined` means "no cue — keep whatever channel the caller is
   * already on." Rent-only fields (`furnished`, `availableFrom`, a
   * monthly price unit, a bare sub-£10k budget) count as cues too, but
   * only when nothing said otherwise explicitly. */
  channel?: Channel
  filters: NlSearchFilters
  /** Free-text place mention, un-geocoded: "Reading", "RG4", "RG1 8BT",
   * "Caversham Heights". Postcodes are normalised to upper case. */
  place?: string
  /** Human labels for wishes the search vocabulary can't filter on yet,
   * de-duplicated, in the order they appeared. */
  unsupported: string[]
  /** Whatever no recogniser (including the place fallback) could
   * explain, with filler words removed — empty when the sentence was
   * fully understood. */
  residual: string
  /** The same text split at the boundaries of what *was* understood —
   * one entry per contiguous unexplained run, the unit the semantic
   * layer (`semantic-hints.ts`) classifies. */
  residualFragments: string[]
  /** True when at least one filter, channel cue or place was found. */
  understood: boolean
}

export interface ParseOptions {
  /** "Today" for resolving relative availability dates ("from October",
   * "available now"). Defaults to the wall clock. */
  now?: Date
}

/** Blanked-out spans are replaced with this rather than spaces so that
 * a later `\s+` can't silently bridge two fragments that were never
 * adjacent in the sentence ("in Reading [2 bed flat] Caversham" must not
 * read as the place "Reading Caversham"). A control character, so it is
 * never a word character and never appears in real input. */
const SENTINEL = '\u0001'

class Working {
  constructor(public text: string) {}

  /** Runs `regex` (must carry the `g` flag) over the live text; for every
   * match `onMatch` returns `false` to leave the span alone, or anything
   * else to consume it. Because consumed spans are replaced in place with
   * equal-length sentinels, indices reported by later regexes stay valid
   * against the original sentence. */
  consume(
    regex: RegExp,
    onMatch: (match: RegExpExecArray) => boolean | void,
  ): void {
    let match: RegExpExecArray | null
    regex.lastIndex = 0
    while ((match = regex.exec(this.text)) !== null) {
      if (match[0].length === 0) {
        regex.lastIndex += 1
        continue
      }
      if (onMatch(match) !== false) {
        this.blank(match.index, match.index + match[0].length)
      }
    }
  }

  blank(start: number, end: number): void {
    this.text =
      this.text.slice(0, start) +
      SENTINEL.repeat(end - start) +
      this.text.slice(end)
  }

  /** The un-consumed fragments, in order. */
  fragments(): string[] {
    return this.text
      .split(SENTINEL)
      .map((part) => part.trim())
      .filter((part) => part.length > 0)
  }
}

// ---------------------------------------------------------------------
// Counts
// ---------------------------------------------------------------------

const NUMBER_WORDS: Record<string, number> = {
  one: 1,
  two: 2,
  three: 3,
  four: 4,
  five: 5,
  six: 6,
  seven: 7,
  eight: 8,
  nine: 9,
  ten: 10,
}
const COUNT = String.raw`(\d{1,2}|one|two|three|four|five|six|seven|eight|nine|ten)`

function parseCount(raw: string): number {
  const lowered = raw.toLowerCase()
  if (lowered in NUMBER_WORDS) return NUMBER_WORDS[lowered]
  return Number.parseInt(lowered, 10)
}

/** `SearchUrlState.minBeds`/`maxBeds` accept 0 (studio) through 6 (6+),
 * the same vocabulary as the Beds filter (`BEDROOM_OPTIONS`). */
function clampBeds(value: number): number {
  return Math.max(0, Math.min(6, value))
}

// ---------------------------------------------------------------------
// Money
// ---------------------------------------------------------------------

const MONEY_MAGNITUDE: Record<string, number> = {
  k: 1_000,
  thousand: 1_000,
  grand: 1_000,
  m: 1_000_000,
  mil: 1_000_000,
  million: 1_000_000,
}

/** `£350k`, `350,000`, `1.2m`, `1200` — three capture groups (pound
 * sign, digits, magnitude). The £ and the magnitude are both optional at
 * the regex level; `isPriceLike` decides whether a bare number was
 * really a price. The trailing lookahead stops "5 m" in "5 mins" from
 * reading as five million. */
const AMOUNT = String.raw`(£)?\s*(\d{1,3}(?:,\d{3})+|\d+(?:\.\d+)?)\s*(k|m|mil|thousand|grand|million)?(?![\w£])`
/** One capture group. */
const PERIOD = String.raw`(pcm|pw|pm|per\s+calendar\s+month|per\s+month|a\s+month|/\s*month|monthly|each\s+month|per\s+week|a\s+week|/\s*week|weekly|each\s+week)`
const OPTIONAL_PERIOD = String.raw`(?:\s*${PERIOD})?`
/** `\b` can't sit before a `£` (two non-word characters), so amounts are
 * anchored with this instead. */
const AMOUNT_START = String.raw`(?<![\w£])`

const MAX_BOUND = String.raw`(?:under|below|less\s+than|up\s+to|upto|max(?:imum)?(?:\s+of)?|no\s+more\s+than|not\s+more\s+than|at\s+most|budget(?:\s+(?:of|is))?|for|cheaper\s+than|capped\s+at|<)`
const MIN_BOUND = String.raw`(?:over|above|more\s+than|at\s+least|min(?:imum)?(?:\s+of)?|from|starting\s+(?:at|from)|upwards\s+of|>)`
const APPROX = String.raw`(?:around|about|approx(?:imately)?|circa|roughly|~)`

interface Money {
  value: number
  hasPound: boolean
  hasMagnitude: boolean
  hasPeriod: boolean
  isWeekly: boolean
}

function readMoney(
  pound: string | undefined,
  digits: string,
  magnitude: string | undefined,
  period: string | undefined,
): Money {
  const base = Number.parseFloat(digits.replace(/,/g, ''))
  const multiplier = magnitude ? MONEY_MAGNITUDE[magnitude.toLowerCase()] : 1
  return {
    value: Math.round(base * multiplier),
    hasPound: pound !== undefined,
    hasMagnitude: magnitude !== undefined,
    hasPeriod: period !== undefined,
    isWeekly: period !== undefined && /w/i.test(period),
  }
}

/** A bare number with no £, no k/m and no pcm/pw is only a price when a
 * bound word introduced it *and* it's big enough to plausibly be one —
 * "from 1 October", "for 2 people" and "over 3 floors" are not prices. */
function isPriceLike(money: Money, bounded: boolean): boolean {
  if (money.hasPound || money.hasMagnitude || money.hasPeriod) return true
  return bounded && money.value >= 100
}

/** Rent is filtered per calendar month (`properties.price` is pcm for
 * the rent channel); a weekly figure converts at 52/12. */
function toMonthly(money: Money): number {
  return money.isWeekly ? Math.round((money.value * 52) / 12) : money.value
}

/** "around £300k" → a ±10% band, rounded to something a human would
 * have typed (nearest £5,000 for sale-sized figures, £50 for rent). */
function approxBand(value: number): { min: number; max: number } {
  const step = value >= 10_000 ? 5_000 : 50
  const round = (n: number) => Math.round(n / step) * step
  return { min: round(value * 0.9), max: round(value * 1.1) }
}

// ---------------------------------------------------------------------
// Vocabulary tables
// ---------------------------------------------------------------------

const HOUSE_TYPES: PropertyType[] = ['detached', 'semi_detached', 'terraced']

/** Ordered: multi-word / more specific phrases first so "semi-detached"
 * is consumed before "detached" can see it, "town house" before
 * "house", "end of terrace" before the generic "terrace". */
const PROPERTY_TYPE_RULES: ReadonlyArray<[RegExp, PropertyType[]]> = (
  [
    [String.raw`semi[- ]?detached|semis?`, ['semi_detached']],
    [String.raw`detached`, ['detached']],
    [
      String.raw`(?:end|mid)[- ](?:of[- ])?terraced?|terraced?|terraces|town[- ]?houses?|townhomes?|mews`,
      ['terraced'],
    ],
    [String.raw`bungalows?`, ['bungalow']],
    [String.raw`maisonettes?`, ['maisonette']],
    [String.raw`flats?|apartments?|penthouses?|condos?`, ['flat']],
    [String.raw`(?:building\s+)?plots?|land`, ['land']],
    [String.raw`houses?|cottages?|villas?|farmhouses?`, HOUSE_TYPES],
  ] as const
).map(([pattern, types]) => [
  // A trailing generic noun belongs to the specific type that precedes
  // it: "detached house" is detached, not detached + every house type.
  new RegExp(
    String.raw`\b(?:${pattern})\b(?:\s+(?:houses?|homes?|propert(?:y|ies)))?`,
    'gi',
  ),
  [...types],
])

/** Wishes the search vocabulary has no filter for. Consumed (so they
 * don't leak into `residual` or masquerade as a place — "near the
 * station" is an amenity, not a town) and reported back as plain
 * labels. */
const UNSUPPORTED_RULES: ReadonlyArray<[RegExp, string]> = [
  [
    /\b(?:off[- ]street\s+)?parking\b|\bdriveway\b|\bgarages?\b|\bcar\s*port\b/gi,
    'Parking',
  ],
  [/\bgardens?\b|\boutdoor\s+space\b|\bpatio\b|\byard\b/gi, 'Garden'],
  [/\bbalcony\b|\bbalconies\b|\broof\s+terrace\b/gi, 'Balcony'],
  [
    /\bpets?[- ]friendly\b|\bpets?\s+(?:allowed|ok|okay|welcome|considered)\b|\bwith\s+(?:a\s+|my\s+|our\s+)?(?:pets?|dogs?|cats?)\b|\bpets?\b|\bdogs?\b|\bcats?\b/gi,
    'Pets allowed',
  ],
  [
    /\bbills\s+(?:included|inc\.?|incl\.?)\b|\ball\s+bills\b/gi,
    'Bills included',
  ],
  [/\ben[- ]?suites?\b/gi, 'En suite'],
  [/\bnew[- ]?builds?\b|\bnewly\s+built\b/gi, 'New build'],
  [/\bchain[- ]free\b|\bno\s+(?:onward\s+)?chain\b/gi, 'Chain free'],
  [
    /\bground[- ]floor\b|\bstep[- ]free\b|\bwheelchair\b|\bwith\s+(?:a\s+)?lift\b|\blift\s+access\b|\baccessible\b/gi,
    'Accessibility',
  ],
  [
    /\b(?:period|victorian|edwardian|georgian|character)(?:\s+(?:property|home|house|flat|features?|conversion))?\b/gi,
    'Period property',
  ],
  [
    /\b(?:near|close\s+to|next\s+to|by|walking\s+distance\s+(?:to|of|from)|within\s+walking\s+distance\s+of)\s+(?:a\s+|the\s+)?(?:good\s+|train\s+|tube\s+|railway\s+|primary\s+|secondary\s+)?(?:stations?|trains?|tube|schools?|shops|park|river|town\s+centre|city\s+centre|hospital|university|uni|motorway|amenities|transport(?:\s+links?)?|m\d{1,2}|a\d{2,4})\b/gi,
    'Near amenities',
  ],
  [
    /\bgood\s+(?:transport(?:\s+links?)?|commute|links|schools)\b|\bcommut(?:e|able|ing)\b|\btransport\s+links?\b/gi,
    'Near amenities',
  ],
  [/\bstudent\s+(?:let|lets|house|flat|accommodation)\b/gi, 'Student let'],
  [
    /\b(?:short|long)[- ]term\b|\b\d+[- ]month\s+(?:let|tenancy|contract)\b/gi,
    'Tenancy length',
  ],
]

/** Words that carry no search meaning on their own. Dropped from
 * `residual` so the semantic layer and the "we didn't understand X"
 * copy only ever see substantive text. Deliberately *not* a general
 * English stop-list: "family", "quiet", "modern" are kept because they
 * are exactly what the embedding model is there to interpret. */
const FILLER = new Set([
  'a',
  'an',
  'the',
  'and',
  'or',
  'but',
  'with',
  'for',
  'of',
  'to',
  'in',
  'on',
  'at',
  'by',
  'near',
  'from',
  'up',
  'that',
  'which',
  'this',
  'it',
  'its',
  'is',
  'are',
  'be',
  'has',
  'have',
  'having',
  'i',
  "i'm",
  'im',
  'me',
  'my',
  'we',
  'our',
  'us',
  'you',
  'find',
  'show',
  'search',
  'searching',
  'look',
  'looking',
  'want',
  'wanted',
  'need',
  'needed',
  'would',
  'like',
  'love',
  'please',
  'ideally',
  'preferably',
  'somewhere',
  'something',
  'anything',
  'place',
  'property',
  'properties',
  'home',
  'homes',
  'listing',
  'listings',
  'nice',
  'good',
  'great',
  'lovely',
  'some',
  'any',
  'no',
  'not',
  'just',
  'only',
  'also',
  'as',
  'so',
  'than',
  'then',
  'there',
  'where',
  'ish',
])

/** Words a place name can't start with (or wholly consist of) — stops
 * "in a quiet area" reading as the place "a quiet area" and "Cheap 2 bed
 * flat" geocoding "Cheap". */
const PLACE_STOP = new Set([
  ...FILLER,
  'quiet',
  'central',
  'city',
  'town',
  'area',
  'areas',
  'centre',
  'center',
  'budget',
  'total',
  'range',
  'price',
  'walking',
  'distance',
  'between',
  'under',
  'over',
  'less',
  'more',
  'about',
  'around',
  'roughly',
  'approx',
  'approximately',
  'circa',
  'cheap',
  'cheaper',
  'affordable',
  'modern',
  'spacious',
  'large',
  'small',
  'big',
  'cosy',
  'cozy',
  'bright',
  'luxury',
  'family',
  'anywhere',
  'everywhere',
])

/** Lower-case connectors a multi-word place name may contain
 * ("Kingston upon Thames"; "Henley-on-Thames" is one token anyway). */
const PLACE_CONNECTORS = new Set(['upon', 'on', 'under', 'by', 'le', 'the'])

/** Lower-case words that legitimately *end* a place name and should be
 * kept when they follow a capitalised one ("Reading station", "Reading
 * town centre") — the geocoder resolves these better than the bare
 * town, so they aren't trimmed like ordinary filler. */
const PLACE_SUFFIXES = new Set([
  'station',
  'centre',
  'center',
  'town',
  'village',
  'common',
  'green',
  'park',
  'hill',
  'heath',
])

const MONTHS: Record<string, number> = {
  jan: 0,
  feb: 1,
  mar: 2,
  apr: 3,
  may: 4,
  jun: 5,
  jul: 6,
  aug: 7,
  sep: 8,
  oct: 9,
  nov: 10,
  dec: 11,
}
const MONTH = String.raw`(jan(?:uary)?|feb(?:ruary)?|mar(?:ch)?|apr(?:il)?|may|june?|july?|aug(?:ust)?|sep(?:t(?:ember)?)?|oct(?:ober)?|nov(?:ember)?|dec(?:ember)?)`

function toIsoDate(year: number, monthIndex: number, day: number): string {
  const date = new Date(Date.UTC(year, monthIndex, day))
  // Rejects impossible dates ("31 February") via the round trip.
  if (date.getUTCMonth() !== monthIndex || date.getUTCDate() !== day) {
    return ''
  }
  return date.toISOString().slice(0, 10)
}

function todayIso(now: Date): string {
  return toIsoDate(now.getFullYear(), now.getMonth(), now.getDate())
}

/** A month/day with no year means the *next* such date — this year if it
 * hasn't passed, otherwise next year. */
function resolveDate(
  now: Date,
  monthIndex: number,
  day: number,
  year?: number,
): string {
  if (year !== undefined) return toIsoDate(year, monthIndex, day)
  const candidate = toIsoDate(now.getFullYear(), monthIndex, day)
  if (candidate && candidate >= todayIso(now)) return candidate
  return toIsoDate(now.getFullYear() + 1, monthIndex, day)
}

function nearestRadiusOption(miles: number): number {
  return SEARCH_RADIUS_MILES_OPTIONS.reduce((best, option) =>
    Math.abs(option - miles) < Math.abs(best - miles) ? option : best,
  )
}

function sortedUnique<T extends string>(values: Iterable<T>): T[] {
  return [...new Set(values)].sort()
}

const PLACE_WORDS = String.raw`((?:[A-Za-z][A-Za-z'’.-]*)(?:[ ][A-Za-z][A-Za-z'’.-]*){0,3})`

/** Tidies the raw words captured after a place preposition: refuses a
 * stop-word start, trims trailing filler ("in Reading please"), and —
 * when the visitor capitalised the name — stops at the first word that
 * isn't itself capitalised or a connector ("in Reading quickly"). */
function readPlaceWords(raw: string): string | undefined {
  const words = raw.split(' ')
  if (words.length === 0 || PLACE_STOP.has(words[0].toLowerCase())) {
    return undefined
  }
  const capitalised = /^[A-Z]/.test(words[0])
  const kept: string[] = [words[0]]
  for (const word of words.slice(1)) {
    const lowered = word.toLowerCase()
    if (PLACE_CONNECTORS.has(lowered) || PLACE_SUFFIXES.has(lowered)) {
      kept.push(word)
      continue
    }
    // A capitalised name ends at the first ordinary lower-case word; an
    // all-lower-case one ("in reading with a park") ends at the first
    // filler word.
    if (capitalised ? !/^[A-Z]/.test(word) : PLACE_STOP.has(lowered)) break
    kept.push(word)
  }
  // A dangling connector ("Kingston upon") is never part of the name.
  while (
    kept.length > 1 &&
    PLACE_CONNECTORS.has(kept[kept.length - 1].toLowerCase())
  ) {
    kept.pop()
  }
  if (kept.length === 0) return undefined
  return kept.join(' ')
}

// ---------------------------------------------------------------------
// The parser
// ---------------------------------------------------------------------

export function parseNaturalLanguageSearch(
  input: string,
  options: ParseOptions = {},
): NlSearchParse {
  const now = options.now ?? new Date()
  const working = new Working(
    input
      .replace(/\s+/g, ' ')
      // "1200pcm" → "1200 pcm" so the amount's own trailing lookahead
      // (which stops "5m" in "5mins" reading as millions) can't reject it.
      .replace(/(\d)(pcm|pw|pm)\b/gi, '$1 $2')
      .trim(),
  )
  const filters: NlSearchFilters = {}
  const unsupported: string[] = []
  const types = new Set<PropertyType>()
  const furnished = new Set<Furnished>()
  let place: string | undefined
  let explicitChannel: Channel | undefined
  let conflictingChannel = false
  let weakRentCue = false

  function noteChannel(channel: Channel): void {
    if (explicitChannel && explicitChannel !== channel) {
      conflictingChannel = true
    }
    explicitChannel = channel
  }

  function noteUnsupported(label: string): void {
    if (!unsupported.includes(label)) unsupported.push(label)
  }

  function applyPrice(min: number | undefined, max: number | undefined): void {
    if (min !== undefined) filters.minPrice = min
    if (max !== undefined) filters.maxPrice = max
  }

  function notePriceChannel(...monies: Money[]): void {
    if (monies.some((money) => money.hasPeriod)) {
      noteChannel('rent')
    } else if (
      monies.every((money) => !money.hasMagnitude && money.value < 10_000)
    ) {
      // "under 1200" is a rent budget — no sale price is ever that small.
      weakRentCue = true
    }
  }

  // -- Postcodes first: they are the most precise location signal and
  //    their digits must never be mistaken for a count or a price. Full
  //    ("RG1 8BT") or outcode-only ("RG4"). "the M4" / "the A33" are
  //    roads, not Manchester and Aberdeen postcode districts.
  working.consume(
    /(?<!\bthe\s)\b([A-PR-UWYZ][A-HK-Y]?\d[A-Z\d]?)(?:\s*(\d[ABD-HJLNP-UW-Z]{2}))?\b/gi,
    (match) => {
      if (place) return false
      const outcode = match[1].toUpperCase()
      // A single letter + digit ("A1", "B2") with no incode is far more
      // often a road or a list marker than a postcode district.
      if (!match[2] && /^[A-Z]\d$/.test(outcode)) return false
      place = match[2] ? `${outcode} ${match[2].toUpperCase()}` : outcode
    },
  )

  // -- Radius ("within 5 miles of Reading") — before price, so "within"
  //    and its number can't be read as a budget. Captures the place that
  //    follows "of" directly, since the generic place rule below doesn't
  //    treat "of" as a location preposition ("lots of light").
  working.consume(
    new RegExp(
      String.raw`\bwithin\s+(\d+(?:\.\d+)?)\s*(miles?|mi|km|kilomet(?:re|er)s?)\b(?:\s+(?:of|from|to)\b)?(?:\s+${PLACE_WORDS})?`,
      'gi',
    ),
    (match) => {
      const raw = Number.parseFloat(match[1])
      const miles = /^k/i.test(match[2]) ? raw * 0.621371 : raw
      filters.radius = nearestRadiusOption(miles)
      // Consume the radius phrase itself, then only as many of the
      // trailing words as actually read as a place name — the rest stay
      // for later recognisers.
      const wordsStart = match.index + match[0].length - (match[3]?.length ?? 0)
      working.blank(match.index, wordsStart)
      if (match[3] && !place) {
        const candidate = readPlaceWords(match[3])
        if (candidate) {
          place = candidate
          working.blank(wordsStart, wordsStart + candidate.length)
        }
      }
      return false
    },
  )

  // -- Studio: both a bedroom count (0) and a type cue (flat).
  working.consume(/\bstudios?\b(?:\s+(?:flats?|apartments?))?/gi, () => {
    filters.minBeds = 0
    filters.maxBeds = 0
    types.add('flat')
  })

  // -- Bedrooms. Ranges first ("2-3 bed", "two or three bedrooms"), then
  //    an upper bound, then the plain / lower-bound form.
  const BEDWORD = String.raw`(?:double\s+)?(?:bed(?:room)?s?|br)\b`
  working.consume(
    new RegExp(
      String.raw`\b(?:between\s+)?${COUNT}\s*(?:-|–|—|to|or)\s*${COUNT}\s*[- ]?${BEDWORD}`,
      'gi',
    ),
    (match) => {
      const low = clampBeds(parseCount(match[1]))
      const high = clampBeds(parseCount(match[2]))
      filters.minBeds = Math.min(low, high)
      filters.maxBeds = Math.max(low, high)
    },
  )
  working.consume(
    new RegExp(
      String.raw`\b(up\s+to|upto|max(?:imum)?(?:\s+of)?|no\s+more\s+than|not\s+more\s+than|at\s+most|fewer\s+than|less\s+than)\s+${COUNT}\s*[- ]?${BEDWORD}`,
      'gi',
    ),
    (match) => {
      const exclusive = /^(?:fewer|less)/i.test(match[1])
      const count = parseCount(match[2])
      filters.maxBeds = clampBeds(exclusive ? count - 1 : count)
    },
  )
  working.consume(
    new RegExp(
      String.raw`\b(?:(exactly|at\s+least|min(?:imum)?(?:\s+of)?|more\s+than|over)\s+)?${COUNT}\s*(\+|plus|or\s+more)?\s*[- ]?${BEDWORD}(?:\s+(?:\+|plus|or\s+more|minimum|min))?`,
      'gi',
    ),
    (match) => {
      const qualifier = (match[1] ?? '').toLowerCase().replace(/\s+/g, ' ')
      let count = parseCount(match[2])
      if (qualifier === 'more than') count += 1
      count = clampBeds(count)
      // "2 bed" reads as "at least 2" — the open-ended reading is the one
      // every UK portal's own beds control uses, and the more forgiving
      // default (a 3-bed is rarely a disappointment to someone who asked
      // for 2). Only "exactly" pins both ends.
      filters.minBeds = count
      if (qualifier === 'exactly') filters.maxBeds = count
    },
  )

  // -- Bathrooms: real intent, no filter for it yet.
  working.consume(
    new RegExp(
      String.raw`\b(?:at\s+least\s+|min(?:imum)?\s+)?${COUNT}\s*\+?\s*[- ]?(?:bath(?:room)?s?|wc)\b`,
      'gi',
    ),
    (match) => {
      const count = parseCount(match[1])
      noteUnsupported(`${count} ${count === 1 ? 'bathroom' : 'bathrooms'}`)
    },
  )

  // -- Availability (rent-only) — before price so "from 1 October" can't
  //    be read as "from £1".
  working.consume(
    /\b(?:available|avail\.?|move(?:[- ]in)?|moving(?:\s+in)?|ready|start(?:ing)?)\s*(?:from|on|by|at|to)?\s*(?:now|immediately|asap|straight\s+away|today)\b|\b(?:asap|immediately|straight\s+away)\b/gi,
    () => {
      filters.availableFrom = todayIso(now)
      weakRentCue = true
    },
  )
  working.consume(
    new RegExp(
      String.raw`\b(?:(available|avail\.?|move(?:[- ]in)?|moving(?:\s+in)?|start(?:ing)?|ready)\s+)?((?:from|by|on|in|for|starting|before|until|till)\s+)?(?:the\s+)?(?:(\d{1,2})(?:st|nd|rd|th)?\s+(?:of\s+)?)?${MONTH}\b\.?(?:\s+(\d{1,2})(?:st|nd|rd|th)?\b)?(?:,?\s+(\d{4})\b)?`,
      'gi',
    ),
    (match) => {
      const [, keyword, preposition, dayBefore, month, dayAfter, yearRaw] =
        match
      // "may" is also a modal verb — only a date when introduced by a
      // keyword ("from May", "available May") or carrying a day/year.
      if (
        month.toLowerCase() === 'may' &&
        !keyword &&
        !preposition &&
        !dayBefore &&
        !dayAfter &&
        !yearRaw
      ) {
        return false
      }
      const monthIndex = MONTHS[month.slice(0, 3).toLowerCase()]
      const day = Number.parseInt(dayBefore ?? dayAfter ?? '1', 10)
      const year = yearRaw ? Number.parseInt(yearRaw, 10) : undefined
      const iso = resolveDate(now, monthIndex, day, year)
      if (!iso) return false
      filters.availableFrom = iso
      weakRentCue = true
    },
  )
  working.consume(
    /\b(?:available|avail\.?|move(?:[- ]in)?|moving(?:\s+in)?|from|by|on|starting)\s+(?:from\s+|on\s+)?(\d{1,2})[/.-](\d{1,2})(?:[/.-](\d{2,4}))?\b/gi,
    (match) => {
      const day = Number.parseInt(match[1], 10)
      const monthIndex = Number.parseInt(match[2], 10) - 1
      if (monthIndex < 0 || monthIndex > 11) return false
      let year: number | undefined
      if (match[3]) {
        year = Number.parseInt(match[3], 10)
        if (year < 100) year += 2000
      }
      const iso = resolveDate(now, monthIndex, day, year)
      if (!iso) return false
      filters.availableFrom = iso
      weakRentCue = true
    },
  )

  // -- Price. Range → bounded → approximate → suffixed → bare budget.
  working.consume(
    new RegExp(
      String.raw`${AMOUNT_START}(between\s+|from\s+)?${AMOUNT}\s*(?:-|–|—|to|and)\s*${AMOUNT}${OPTIONAL_PERIOD}`,
      'gi',
    ),
    (match) => {
      const [
        ,
        prefix,
        lowPound,
        lowDigits,
        lowMag,
        highPound,
        highDigits,
        highMag,
        period,
      ] = match
      const high = readMoney(highPound, highDigits, highMag, period)
      // "200-300k": the first figure borrows the second's magnitude.
      const low = readMoney(
        lowPound,
        lowDigits,
        lowMag ?? (lowPound === undefined ? highMag : undefined),
        period,
      )
      const bounded = prefix !== undefined
      const plausible =
        isPriceLike(low, false) ||
        isPriceLike(high, false) ||
        (bounded && low.value >= 100 && high.value >= 100) ||
        (low.value >= 1_000 && high.value >= 1_000)
      if (!plausible) return false
      applyPrice(toMonthly(low), toMonthly(high))
      notePriceChannel(low, high)
    },
  )
  working.consume(
    new RegExp(String.raw`\b${MAX_BOUND}\s*${AMOUNT}${OPTIONAL_PERIOD}`, 'gi'),
    (match) => {
      const money = readMoney(match[1], match[2], match[3], match[4])
      if (!isPriceLike(money, true)) return false
      applyPrice(undefined, toMonthly(money))
      notePriceChannel(money)
    },
  )
  working.consume(
    new RegExp(String.raw`\b${MIN_BOUND}\s*${AMOUNT}${OPTIONAL_PERIOD}`, 'gi'),
    (match) => {
      const money = readMoney(match[1], match[2], match[3], match[4])
      if (!isPriceLike(money, true)) return false
      applyPrice(toMonthly(money), undefined)
      notePriceChannel(money)
    },
  )
  working.consume(
    new RegExp(
      String.raw`\b${APPROX}\s*${AMOUNT}${OPTIONAL_PERIOD}|${AMOUNT_START}${AMOUNT}${OPTIONAL_PERIOD}\s*(?:-?ish|or\s+so|or\s+thereabouts)\b`,
      'gi',
    ),
    (match) => {
      const money =
        match[2] !== undefined
          ? readMoney(match[1], match[2], match[3], match[4])
          : readMoney(match[5], match[6], match[7], match[8])
      if (!isPriceLike(money, true)) return false
      const band = approxBand(toMonthly(money))
      applyPrice(band.min, band.max)
      notePriceChannel(money)
    },
  )
  working.consume(
    new RegExp(
      String.raw`${AMOUNT_START}${AMOUNT}${OPTIONAL_PERIOD}\s*(?:max(?:imum)?|tops|at\s+most|or\s+less|or\s+under|or\s+below)\b`,
      'gi',
    ),
    (match) => {
      const money = readMoney(match[1], match[2], match[3], match[4])
      if (!isPriceLike(money, true)) return false
      applyPrice(undefined, toMonthly(money))
      notePriceChannel(money)
    },
  )
  working.consume(
    new RegExp(
      String.raw`${AMOUNT_START}${AMOUNT}${OPTIONAL_PERIOD}\s*(?:\+|plus|min(?:imum)?|upwards|or\s+more|and\s+up|and\s+above|or\s+over|or\s+above)(?![\w])`,
      'gi',
    ),
    (match) => {
      const money = readMoney(match[1], match[2], match[3], match[4])
      if (!isPriceLike(money, true)) return false
      applyPrice(toMonthly(money), undefined)
      notePriceChannel(money)
    },
  )
  working.consume(
    new RegExp(String.raw`${AMOUNT_START}${AMOUNT}${OPTIONAL_PERIOD}`, 'gi'),
    (match) => {
      const money = readMoney(match[1], match[2], match[3], match[4])
      if (!isPriceLike(money, false)) return false
      // A bare figure ("£350k flat in Reading") is a budget — a ceiling —
      // unless a bounded form already set one.
      if (filters.maxPrice === undefined) {
        applyPrice(undefined, toMonthly(money))
      }
      notePriceChannel(money)
    },
  )

  // -- Channel cues.
  working.consume(
    /\b(?:to\s+rent|for\s+rent|to\s+let|for\s+let|rent(?:al|als|ing|ed)?|lettings?|tenants?|tenancy|landlords?)\b/gi,
    () => noteChannel('rent'),
  )
  working.consume(
    /\b(?:to\s+buy|for\s+sale|buy(?:ing)?|purchas(?:e|ing)|sale|mortgage|first[- ]time\s+buyers?|first\s+home|freehold|leasehold)\b/gi,
    () => noteChannel('sale'),
  )

  // -- Furnishing (rent-only). "unfurnished" and "part furnished" must be
  //    consumed before the bare "furnished" can see them.
  working.consume(/\bun-?furnished\b/gi, () => {
    furnished.add('unfurnished')
    weakRentCue = true
  })
  working.consume(/\b(?:part(?:ly|ially)?|semi)[- ]furnished\b/gi, () => {
    furnished.add('part_furnished')
    weakRentCue = true
  })
  working.consume(/\b(?:fully\s+)?furnished\b/gi, () => {
    furnished.add('furnished')
    weakRentCue = true
  })

  // -- Unsupported wishes (before types: "roof terrace" ≠ terraced).
  for (const [regex, label] of UNSUPPORTED_RULES) {
    working.consume(regex, () => noteUnsupported(label))
  }

  // -- Property types.
  for (const [regex, ruleTypes] of PROPERTY_TYPE_RULES) {
    working.consume(regex, () => {
      for (const type of ruleTypes) types.add(type)
    })
  }

  // -- Sort and view.
  working.consume(
    /\b(?:cheapest(?:\s+first)?|lowest\s+price(?:d)?(?:\s+first)?|price(?:d)?\s+low(?:est)?\s+to\s+high(?:est)?|low\s+to\s+high|(?:sorted?\s+)?by\s+price(?:\s+ascending)?|ascending\s+price|cheap|affordable|bargain|inexpensive)\b/gi,
    () => {
      // "cheap" has no price to filter on, but "cheapest first" is the
      // honest reading of it.
      filters.sort = 'price_asc'
    },
  )
  working.consume(
    /\b(?:most\s+expensive(?:\s+first)?|priciest|dearest|highest\s+price(?:d)?(?:\s+first)?|price(?:d)?\s+high(?:est)?\s+to\s+low(?:est)?|high\s+to\s+low|descending\s+price)\b/gi,
    () => {
      filters.sort = 'price_desc'
    },
  )
  working.consume(
    /\b(?:newest(?:\s+first)?|latest(?:\s+first)?|most\s+recent(?:ly)?(?:\s+(?:listed|added))?|just\s+(?:listed|added)|new(?:ly)?\s+(?:listed|added|on\s+the\s+market))\b/gi,
    () => {
      // `newest` is the default sort and is never written to the URL
      // (search-url.ts's canonicalisation) — consuming the phrase is the
      // whole job.
      delete filters.sort
    },
  )
  working.consume(
    /\b(?:on\s+(?:a|the)\s+map|map\s+view|(?:show|see|view)\s+(?:me\s+)?(?:it\s+|them\s+|results\s+)?(?:on\s+)?(?:a\s+|the\s+)?map|as\s+a\s+map|map)\b/gi,
    () => {
      filters.view = 'map'
    },
  )

  // -- Place: "in Reading", "near Caversham Heights", "close to Earley".
  if (!place) {
    working.consume(
      new RegExp(
        String.raw`\b(?:in|near|nearby|around|close\s+to|next\s+to|at|by|towards)\s+${PLACE_WORDS}`,
        'gi',
      ),
      (match) => {
        if (place) return false
        const candidate = readPlaceWords(match[1])
        if (!candidate) return false
        place = candidate
        // Consume only the preposition + the words actually kept
        // (`readPlaceWords` always returns a prefix of the captured run).
        const kept = match[0].length - match[1].length + candidate.length
        working.blank(match.index, match.index + kept)
        return false
      },
    )
  }

  // -- Place fallback on whatever's left: a curated area label anywhere
  //    ("reading 2 bed flat"), else a run of Capitalised words ("Caversham
  //    2 bed", "2 bed flat Basingstoke").
  if (!place) {
    outer: for (const fragment of working.fragments()) {
      const words = fragment.split(' ')
      for (let size = Math.min(3, words.length); size >= 1; size -= 1) {
        for (let start = 0; start + size <= words.length; start += 1) {
          const candidate = words.slice(start, start + size).join(' ')
          const area = matchCuratedArea(candidate.replace(/[^A-Za-z'’ -]/g, ''))
          if (area) {
            place = area.label
            const index = working.text.indexOf(candidate)
            if (index >= 0) working.blank(index, index + candidate.length)
            break outer
          }
        }
      }
    }
  }
  if (!place) {
    working.consume(
      /(?<![\w\u0001])((?:[A-Z][a-z'’-]+)(?:[ ](?:[A-Z][a-z'’-]+|upon|on|under|by|le|the))*)(?![\w])/g,
      (match) => {
        if (place) return false
        const candidate = readPlaceWords(match[1])
        if (!candidate) return false
        place = candidate
        working.blank(match.index, match.index + candidate.length)
        return false
      },
    )
  }

  // -- Whatever survived is unexplained. Fragment boundaries are kept
  //    (one fragment per contiguous unexplained run) because the semantic
  //    layer classifies each run on its own — "quiet area" and "log
  //    burner" are two thoughts, not one.
  const residualFragments = working
    .fragments()
    .map((fragment) =>
      fragment
        .split(/\s+/)
        .map((word) => word.replace(/^[^\w£]+|[^\w£]+$/g, ''))
        .filter((word) => word.length > 0 && !FILLER.has(word.toLowerCase()))
        .join(' '),
    )
    .filter((fragment) => fragment.length > 0)
  const residual = residualFragments.join(' ')

  if (types.size > 0) filters.type = sortedUnique(types)
  if (furnished.size > 0) filters.furnished = sortedUnique(furnished)

  // Rent-only fields are also channel evidence, but only when nothing
  // said otherwise explicitly ("furnished house for sale" is odd, but
  // the visitor did say "for sale").
  let channel: Channel | undefined
  if (!conflictingChannel) {
    channel = explicitChannel ?? (weakRentCue ? 'rent' : undefined)
  }

  const hasFilters = Object.values(filters).some((value) => value !== undefined)

  return {
    channel,
    filters,
    place,
    unsupported,
    residual,
    residualFragments,
    understood: hasFilters || channel !== undefined || place !== undefined,
  }
}
