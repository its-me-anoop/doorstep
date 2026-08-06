/**
 * Pure, deterministic generator behind scripts/seed-search-5k.ts (M2's 5k
 * search bench evidence task, PRD §13's M2 exit criterion: "Seeded 5k
 * listings; p75 search under 500 ms"). Mirrors scripts/seed-data.ts's
 * shape (insert-ready, natural-key cross-references, no ids) but is a
 * *generated* 5000-row set rather than hand-written fixtures.
 *
 * Deterministic by construction, same discipline as scripts/seed-data.ts's
 * own header comment requires: a seeded PRNG (mulberry32 — small, fast,
 * good enough statistical quality for fixture generation, not
 * cryptography), no `Date.now()`, no `Math.random()`, no
 * `crypto.randomUUID()`. Calling `generateBenchProperties(5000)` twice
 * produces byte-identical output, which is what makes
 * scripts/seed-search-5k.ts's delete-by-known-slug-then-insert idempotent
 * the same way scripts/seed.ts's fixed fixtures are.
 *
 * Every property references one single synthetic bench lister
 * (BENCH_LISTER_FIREBASE_UID) rather than several listers/agencies —
 * this data exists to exercise SearchListings' filter/geo/sort paths at
 * volume, not the lister/agency relationship, which the fixed 20-listing
 * seed (scripts/seed-data.ts) and its own tests already cover.
 */

import type {
  Channel,
  CouncilTaxBand,
  EpcRating,
  Furnished,
  PriceQualifier,
  PropertyType,
  Tenure,
} from '@/domain/enums'
import {
  generateListingSlug,
  generateListingTitle,
} from '@/domain/listing-copy'
import type { GeoPoint } from '@/domain/property'

/** The one synthetic lister every bench property belongs to. Distinct
 * prefix from scripts/seed-data.ts's `seed-` so the two data sets never
 * collide and can be cleaned up independently (scripts/seed-search-5k.ts's
 * `--clean` deletes by this prefix). */
export const BENCH_LISTER_FIREBASE_UID = 'doorstep-bench-lister'
export const BENCH_LISTER_EMAIL = `${BENCH_LISTER_FIREBASE_UID}@bench.doorstep.test`
export const BENCH_LISTER_DISPLAY_NAME = 'Search Bench Fixture Lister'

export interface TownFixture {
  name: string
  outcode: string
  lat: number
  lng: number
}

/** 15 real Thames Valley towns, each with an approximate centroid and its
 * real outward postcode — good enough for geo-radius/bbox bench queries
 * to exercise real distances between real places, not survey-grade
 * accuracy. */
export const THAMES_VALLEY_TOWNS: TownFixture[] = [
  { name: 'Reading', outcode: 'RG1', lat: 51.4543, lng: -0.9781 },
  { name: 'Caversham', outcode: 'RG4', lat: 51.4712, lng: -0.9754 },
  { name: 'Earley', outcode: 'RG6', lat: 51.4372, lng: -0.9334 },
  { name: 'Woodley', outcode: 'RG5', lat: 51.4453, lng: -0.8993 },
  { name: 'Tilehurst', outcode: 'RG31', lat: 51.4519, lng: -1.0247 },
  { name: 'Wokingham', outcode: 'RG40', lat: 51.4113, lng: -0.8347 },
  { name: 'Bracknell', outcode: 'RG12', lat: 51.416, lng: -0.7526 },
  { name: 'Maidenhead', outcode: 'SL6', lat: 51.5225, lng: -0.7181 },
  { name: 'Windsor', outcode: 'SL4', lat: 51.4839, lng: -0.6042 },
  { name: 'Slough', outcode: 'SL1', lat: 51.5105, lng: -0.595 },
  { name: 'Newbury', outcode: 'RG14', lat: 51.4014, lng: -1.3145 },
  { name: 'Thatcham', outcode: 'RG19', lat: 51.4013, lng: -1.2547 },
  { name: 'Henley-on-Thames', outcode: 'RG9', lat: 51.5362, lng: -0.8992 },
  { name: 'Marlow', outcode: 'SL7', lat: 51.5713, lng: -0.7773 },
  { name: 'High Wycombe', outcode: 'HP11', lat: 51.6287, lng: -0.7481 },
]

const PROPERTY_TYPES: PropertyType[] = [
  'detached',
  'semi_detached',
  'terraced',
  'flat',
  'bungalow',
  'maisonette',
  'land',
  'other',
]
const TENURES: Tenure[] = [
  'freehold',
  'leasehold',
  'share_of_freehold',
  'unknown',
]
const FURNISHED_VALUES: Furnished[] = [
  'furnished',
  'part_furnished',
  'unfurnished',
]
const PRICE_QUALIFIERS: PriceQualifier[] = [
  'fixed',
  'fixed',
  'fixed',
  'guide_price',
  'offers_over',
  'offers_in_region',
  'poa',
]
const EPC_RATINGS: EpcRating[] = ['A', 'B', 'C', 'D', 'E', 'F', 'G']
const COUNCIL_TAX_BANDS: CouncilTaxBand[] = [
  'A',
  'B',
  'C',
  'D',
  'E',
  'F',
  'G',
  'H',
]
const STREET_NAMES = [
  'Church Road',
  'Station Road',
  'Kings Road',
  'Mill Lane',
  'Victoria Street',
  'Oxford Road',
  'Wood Lane',
  'The Green',
  'Meadow Way',
  'Park Avenue',
  'Bridge Street',
  'High Street',
]
const FEATURE_POOL = [
  'garden',
  'off-street parking',
  'garage',
  'balcony',
  'en-suite',
  'conservatory',
  'double glazing',
  'fireplace',
  'south-facing garden',
  'utility room',
]

/** mulberry32 — small, fast, deterministic PRNG. Not cryptographic; only
 * used here to generate reproducible fixture data. */
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

function intBetween(rand: () => number, min: number, max: number): number {
  return min + Math.floor(rand() * (max - min + 1))
}

interface PriceRange {
  min: number
  max: number
}

/** Deliberately approximate, plausible UK price bands per type/channel —
 * not real market data, just wide enough ranges that filter queries
 * (priceMin/priceMax) return meaningfully different result sets. */
const SALE_PRICE_RANGE: Record<PropertyType, PriceRange> = {
  land: { min: 50_000, max: 500_000 },
  flat: { min: 120_000, max: 450_000 },
  maisonette: { min: 130_000, max: 400_000 },
  terraced: { min: 200_000, max: 450_000 },
  semi_detached: { min: 250_000, max: 550_000 },
  bungalow: { min: 220_000, max: 500_000 },
  detached: { min: 350_000, max: 1_200_000 },
  other: { min: 100_000, max: 800_000 },
}
const RENT_PCM_RANGE: Record<PropertyType, PriceRange> = {
  land: { min: 200, max: 800 },
  flat: { min: 700, max: 2200 },
  maisonette: { min: 750, max: 2000 },
  terraced: { min: 900, max: 2500 },
  semi_detached: { min: 1000, max: 2800 },
  bungalow: { min: 900, max: 2400 },
  detached: { min: 1500, max: 4500 },
  other: { min: 700, max: 3000 },
}
const BEDROOM_RANGE: Record<PropertyType, { min: number; max: number }> = {
  land: { min: 0, max: 0 },
  flat: { min: 0, max: 3 },
  maisonette: { min: 1, max: 3 },
  terraced: { min: 2, max: 4 },
  semi_detached: { min: 2, max: 4 },
  bungalow: { min: 2, max: 4 },
  detached: { min: 3, max: 6 },
  other: { min: 1, max: 4 },
}

/** Insert-ready shape — matches scripts/seed-data.ts's SeedProperty save
 * for `listerEmail` always resolving to the one bench lister and
 * `agencySlug` always being absent (no bench agency). */
export interface BenchProperty {
  slug: string
  listerEmail: string
  channel: Channel
  status: 'published'
  propertyType: PropertyType
  title: string
  description: string
  features: string[]
  bedrooms: number
  bathrooms: number
  price: number
  priceQualifier: PriceQualifier
  tenure: Tenure | null
  deposit: number | null
  furnished: Furnished | null
  availableFrom: string | null
  epcRating: EpcRating
  councilTaxBand: CouncilTaxBand
  newHome: boolean
  addressLine1: string
  displayAddress: string
  town: string
  outcode: string
  postcode: string
  location: GeoPoint
  locationApproximate: false
  /** ISO datetime — spread over a fixed 90-day window ending at a fixed
   * reference date, never `Date.now()` (this file's determinism
   * requirement). */
  publishedAt: string
}

const SEED = 20260601
/** A fixed reference "now" for spreading publishedAt across the last 90
 * days — NOT `Date.now()`, so output is stable across runs and machines. */
const PUBLISHED_AT_REFERENCE = Date.parse('2026-08-01T00:00:00Z')
const PUBLISHED_AT_SPREAD_DAYS = 90
/** Roughly ±0.02 degrees (~1.5-2.2km at this latitude) of jitter around a
 * town centroid — enough that a 1-3 mile radius search around the same
 * town returns a meaningfully different subset than a 10+ mile one,
 * without listings straying into a neighbouring town's own fixtures. */
const GEO_JITTER_DEGREES = 0.02

function jitter(rand: () => number, value: number): number {
  return value + (rand() * 2 - 1) * GEO_JITTER_DEGREES
}

function synthesizePostcode(rand: () => number, outcode: string): string {
  const digit = intBetween(rand, 0, 9)
  const letters = 'ABDEFGHJLNPQRSTUWXYZ' // excludes C,I,K,M,O,V (postcodes.io/Royal Mail's excluded inward letters)
  const l1 = letters[Math.floor(rand() * letters.length)]
  const l2 = letters[Math.floor(rand() * letters.length)]
  return `${outcode} ${digit}${l1}${l2}`
}

export function generateBenchProperties(count: number): BenchProperty[] {
  const rand = mulberry32(SEED)
  const properties: BenchProperty[] = []

  for (let i = 0; i < count; i += 1) {
    const town = pick(rand, THAMES_VALLEY_TOWNS)
    // ~70% sale, 30% rent — land only ever sells.
    const propertyType = pick(rand, PROPERTY_TYPES)
    const channel: Channel =
      propertyType === 'land' || rand() < 0.7 ? 'sale' : 'rent'

    const bedroomsRange = BEDROOM_RANGE[propertyType]
    const bedrooms = intBetween(rand, bedroomsRange.min, bedroomsRange.max)
    const bathrooms = Math.max(1, intBetween(rand, 1, Math.max(1, bedrooms)))

    const priceRange =
      channel === 'sale'
        ? SALE_PRICE_RANGE[propertyType]
        : RENT_PCM_RANGE[propertyType]
    const priceStep = channel === 'sale' ? 5000 : 25
    const price =
      Math.round(intBetween(rand, priceRange.min, priceRange.max) / priceStep) *
      priceStep

    const tenure = channel === 'sale' ? pick(rand, TENURES) : null
    const furnished = channel === 'rent' ? pick(rand, FURNISHED_VALUES) : null
    const deposit = channel === 'rent' ? price * intBetween(rand, 4, 6) : null
    const newHome = rand() < 0.1

    // ~30% of rent listings are available now (null); the rest spread
    // over the next ~120 days from the fixed reference date.
    const availableFrom =
      channel === 'rent' && rand() >= 0.3
        ? new Date(
            PUBLISHED_AT_REFERENCE + intBetween(rand, 1, 120) * 86_400_000,
          )
            .toISOString()
            .slice(0, 10)
        : null

    const featureCount = intBetween(rand, 0, 4)
    const features = Array.from(
      new Set(
        Array.from({ length: featureCount }, () => pick(rand, FEATURE_POOL)),
      ),
    )

    const houseNumber = intBetween(rand, 1, 220)
    const street = pick(rand, STREET_NAMES)
    const addressLine1 = `${houseNumber} ${street}`
    const displayAddress = `${addressLine1}, ${town.name}`

    const publishedAt = new Date(
      PUBLISHED_AT_REFERENCE -
        intBetween(rand, 0, PUBLISHED_AT_SPREAD_DAYS) * 86_400_000,
    )

    const uniqueSeed = `bench-${i.toString(16).padStart(8, '0')}`
    const slug = generateListingSlug({
      bedrooms,
      propertyType,
      outcode: town.outcode,
      uniqueSeed,
    })
    const title = generateListingTitle({ bedrooms, propertyType, channel })

    properties.push({
      slug,
      listerEmail: BENCH_LISTER_EMAIL,
      channel,
      status: 'published',
      propertyType,
      title,
      description: `${title} in ${town.name}. Generated fixture for the M2 search bench (PRD §13).`,
      features,
      bedrooms,
      bathrooms,
      price,
      priceQualifier: pick(rand, PRICE_QUALIFIERS),
      tenure,
      deposit,
      furnished,
      availableFrom,
      epcRating: pick(rand, EPC_RATINGS),
      councilTaxBand: pick(rand, COUNCIL_TAX_BANDS),
      newHome,
      addressLine1,
      displayAddress,
      town: town.name,
      outcode: town.outcode,
      postcode: synthesizePostcode(rand, town.outcode),
      location: {
        lat: jitter(rand, town.lat),
        lng: jitter(rand, town.lng),
      },
      locationApproximate: false,
      publishedAt: publishedAt.toISOString(),
    })
  }

  return properties
}
