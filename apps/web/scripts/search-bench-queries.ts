/**
 * Pure helpers behind scripts/search-bench.ts (M2's 5k bench evidence
 * task, PRD §13's "p75 search under 500 ms"): `buildBenchQueries`
 * generates N deterministic, realistic GET /api/v1/search query strings;
 * `percentile` computes a latency percentile from a sample of
 * measurements. Both are pure and unit-tested
 * (tests/unit/scripts/search-bench-queries.test.ts) — the I/O half (firing
 * real HTTP requests, printing the results table) lives only in
 * search-bench.ts itself, which has no dedicated test for the same reason
 * scripts/seed.ts doesn't: there is no live server to hit on this
 * machine.
 */

/** mulberry32 — same small deterministic PRNG as
 * scripts/search-bench-data.ts (duplicated rather than shared: it's nine
 * lines, and the two callers seed it independently for unrelated data —
 * sharing a "PRNG utility" module for something this small would be
 * indirection without a real second axis of reuse). */
function mulberry32(seed: number): () => number {
  let state = seed >>> 0
  return function next(): number {
    state = (state + 0x6d2b79f5) | 0
    let t = Math.imul(state ^ (state >>> 15), 1 | state)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

function pick<T>(rand: () => number, items: readonly T[]): T {
  const item = items[Math.floor(rand() * items.length)]
  if (item === undefined) throw new Error('pick: items must be non-empty')
  return item
}

const QUERY_SEED = 20260601

/** Reading, Caversham and Earley centroids — the three named-in-the-brief
 * radius-search anchors, matching scripts/search-bench-data.ts's
 * THAMES_VALLEY_TOWNS entries for the same three towns so radius queries
 * actually land inside the seeded 5k's densest cluster. */
const RADIUS_ANCHORS = [
  { lat: 51.4543, lng: -0.9781 }, // Reading
  { lat: 51.4712, lng: -0.9754 }, // Caversham
  { lat: 51.4372, lng: -0.9334 }, // Earley
]
const RADIUS_MILES_OPTIONS = [1, 2, 3, 5, 10, 20]
const SORTS = ['newest', 'price_asc', 'price_desc']
const PROPERTY_TYPES = [
  'detached',
  'semi_detached',
  'terraced',
  'flat',
  'bungalow',
  'maisonette',
  'other',
]
const TOWNS = ['Reading', 'Caversham', 'Earley', 'Woodley', 'Wokingham']

function maybeAddGeo(rand: () => number, params: URLSearchParams): void {
  // ~60% of queries carry a radius search — the dominant, geo-driven
  // discovery path PRD §8.6 describes.
  if (rand() >= 0.6) return
  const anchor = pick(rand, RADIUS_ANCHORS)
  params.set('lat', String(anchor.lat))
  params.set('lng', String(anchor.lng))
  params.set('radiusMiles', String(pick(rand, RADIUS_MILES_OPTIONS)))
}

function maybeAddFilters(
  rand: () => number,
  params: URLSearchParams,
  channel: 'sale' | 'rent',
): void {
  if (rand() < 0.5) {
    const range =
      channel === 'sale'
        ? [
            [150_000, 300_000],
            [300_000, 500_000],
            [500_000, 1_000_000],
          ]
        : [
            [700, 1200],
            [1200, 1800],
            [1800, 3000],
          ]
    const [min, max] = pick(rand, range) as [number, number]
    params.set('priceMin', String(min))
    params.set('priceMax', String(max))
  }
  if (rand() < 0.4) {
    params.set('bedsMin', String(pick(rand, [1, 2, 3])))
  }
  if (rand() < 0.3) {
    const count = pick(rand, [1, 2])
    const types = Array.from(
      new Set(Array.from({ length: count }, () => pick(rand, PROPERTY_TYPES))),
    )
    params.set('types', types.join(','))
  }
  if (rand() < 0.2) {
    params.set('town', pick(rand, TOWNS))
  }
  if (channel === 'rent' && rand() < 0.2) {
    params.set('furnished', pick(rand, ['furnished', 'unfurnished']))
  }
  if (channel === 'sale' && rand() < 0.2) {
    params.set('tenure', pick(rand, ['freehold', 'leasehold']))
  }
}

/**
 * N deterministic query strings mixing realistic radius searches (around
 * Reading/Caversham/Earley), filter combinations, sorts and pages 1-3 —
 * this task's brief's own "mixed realistic queries" description.
 */
export function buildBenchQueries(n: number): URLSearchParams[] {
  const rand = mulberry32(QUERY_SEED)
  const queries: URLSearchParams[] = []

  for (let i = 0; i < n; i += 1) {
    const channel = rand() < 0.7 ? 'sale' : 'rent'
    const params = new URLSearchParams()
    params.set('channel', channel)
    params.set('sort', pick(rand, SORTS))
    params.set('page', String(pick(rand, [1, 2, 3])))

    maybeAddGeo(rand, params)
    maybeAddFilters(rand, params, channel)

    queries.push(params)
  }

  return queries
}

/**
 * Linear-interpolation percentile (the "nearest-rank with interpolation"
 * method most latency-reporting tools use) — sorts a copy of `values`
 * internally, so the caller's own array/order is untouched.
 */
export function percentile(values: readonly number[], p: number): number {
  if (values.length === 0) {
    throw new Error('percentile: values must be non-empty')
  }
  const sorted = [...values].sort((a, b) => a - b)
  if (sorted.length === 1) return sorted[0] as number

  const rank = (p / 100) * (sorted.length - 1)
  const lowerIndex = Math.floor(rank)
  const upperIndex = Math.ceil(rank)
  const lower = sorted[lowerIndex] as number
  const upper = sorted[upperIndex] as number
  const fraction = rank - lowerIndex
  return lower + (upper - lower) * fraction
}
