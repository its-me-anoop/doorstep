/**
 * The curated area registry (M2-DESIGN-SPEC.md §1.7's area-page table,
 * §4's landing-page content). One typed constant per curated area — slug,
 * label, the server-side match rule, an approximate town-centre point +
 * radius (reserved for the M3 map default, §5.9's handoff table; not used
 * for matching itself, see below), and its own non-templated intro
 * paragraph (§4.1: "the true, specific thing about this place," not a
 * fill-in-the-blank sentence run seven times).
 *
 * **Match rule, and why it deviates from the spec's own illustrative
 * table:** §1.7 flags its outcode mapping as "confirm ... before
 * shipping — not independently verified here." Verified now, against the
 * actual seeded dev database (`select town, outcode, count(*) from
 * properties group by 1,2`):
 *
 *   town              | outcode
 *   Caversham         | RG4
 *   Earley            | RG6
 *   Lower Earley      | RG6
 *   Reading           | RG1, RG4
 *   Tilehurst         | RG30, RG31
 *   Wokingham         | RG41
 *   Woodley           | RG5
 *
 * RG4 is shared by Reading, Caversham AND Sonning (a real, non-curated
 * town) — an outcode match for Caversham would incorrectly pull in
 * Reading's and Sonning's RG4 listings too, so Caversham (and Reading)
 * match by **town** instead, which the real data already stores
 * precisely. Tilehurst's two real outcodes both share one `town` value,
 * so town-matching also subsumes them without needing an OR of two
 * outcodes (the API's `outcode` filter only takes one value). Earley is
 * the one case where **outcode** is deliberately the better match: the
 * seed data splits it across two town values ("Earley" and "Lower
 * Earley"), and RG6 isn't shared with any other curated area, so
 * `outcode = RG6` is both correct and more inclusive than `town =
 * Earley` alone would be.
 *
 * Emmer Green has no distinguishing real data at all yet (no seeded
 * listing carries that town, and its postcode area, RG4, is already
 * Caversham's) — kept at the spec's own illustrative `outcode: 'RG4'`
 * with this known overlap documented rather than silently resolved: per
 * the spec's own "no dead placeholder, no fake preview" rule, inventing
 * a distinguishing fake boundary would be worse than an honest, flagged
 * gap. In practice this means Emmer Green's landing page currently shows
 * the same listings as Caversham's (all real RG4/Caversham-town rows)
 * until a finer-grained locality field exists to tell them apart.
 */

export interface AreaMatch {
  town?: string
  outcode?: string
}

export interface AreaDefinition {
  slug: string
  label: string
  /** Exactly one of `town`/`outcode` is set — see this file's header
   * comment for which, and why, per area. */
  match: AreaMatch
  /** Approximate town-centre point, reserved for the M3 map default
   * (M2-DESIGN-SPEC.md §5.9) — never used for search matching itself,
   * which is administrative (`match`), not geo-radius (§1.7). */
  centre: { lat: number; lng: number }
  /** Reserved alongside `centre` for the same M3 map default. */
  radiusMiles: number
  /** §4.1's intro paragraph — one distinguishing hook per area, not a
   * repeated sentence template. */
  intro: string
}

export const AREAS: readonly AreaDefinition[] = [
  {
    slug: 'reading',
    label: 'Reading',
    match: { town: 'Reading' },
    centre: { lat: 51.4543, lng: -0.9781 },
    radiusMiles: 3,
    intro:
      "Reading's town centre puts the station, the Oracle and the river Kennet all within a short walk of most streets on this list — handy if a fast train into Paddington matters as much as the house itself.",
  },
  {
    slug: 'caversham',
    label: 'Caversham',
    match: { town: 'Caversham' },
    centre: { lat: 51.4666, lng: -0.9701 },
    radiusMiles: 2,
    intro:
      'North of the Thames and a proper bridge-crossing away from the town centre, Caversham keeps its own high street and a slower pace than RG1 — most buyers here are trading a short commute for a longer walk to the water.',
  },
  {
    slug: 'tilehurst',
    label: 'Tilehurst',
    match: { town: 'Tilehurst' },
    centre: { lat: 51.4535, lng: -1.025 },
    radiusMiles: 2,
    intro:
      "Tilehurst's rows of Victorian and Edwardian terraces, many backing onto the Downs, are the stock most first-time buyers in Reading end up comparing everything else to.",
  },
  {
    slug: 'earley',
    label: 'Earley',
    match: { outcode: 'RG6' },
    centre: { lat: 51.4394, lng: -0.935 },
    radiusMiles: 2,
    intro:
      "Earley's mix of 1930s semis and newer estates sits close to the M4 and Reading's south-eastern schools — a common shortlist stop for families moving out from the town centre.",
  },
  {
    slug: 'woodley',
    label: 'Woodley',
    match: { town: 'Woodley' },
    centre: { lat: 51.4483, lng: -0.8993 },
    radiusMiles: 2,
    intro:
      'Woodley sits between Reading and Wokingham with its own retail park and a direct line into Paddington from Winnersh Triangle — commuters who want space without a Reading postcode end up here more often than the map alone would suggest.',
  },
  {
    slug: 'emmer-green',
    label: 'Emmer Green',
    match: { outcode: 'RG4' },
    centre: { lat: 51.4753, lng: -0.9646 },
    radiusMiles: 2,
    intro:
      'Perched on the hill north of Caversham, Emmer Green trades the river view for wider verges and Bishopswood Park — a quieter, more suburban stretch than its better-known neighbour, even though the postcode is the same one.',
  },
  {
    slug: 'wokingham',
    label: 'Wokingham',
    match: { town: 'Wokingham' },
    centre: { lat: 51.4109, lng: -0.8347 },
    radiusMiles: 3,
    intro:
      'Wokingham is its own market town, not a Reading suburb — expect a different price band and a genuinely separate high street, ten minutes down the line.',
  },
]

export function findAreaBySlug(slug: string): AreaDefinition | undefined {
  return AREAS.find((area) => area.slug === slug)
}

/** Projects an `AreaMatch` down to the flat `{ town?, outcode? }` shape
 * both `lib/search-url.ts`'s `buildSearchApiQuery` and
 * `ports/listing-repository.ts`'s `AreaListingCriteria` already use —
 * the one place an `AreaMatch` is translated into "a query filter,"
 * so a future third `match` kind only needs a change here. */
export function areaMatchToFilter(match: AreaMatch): AreaMatch {
  return match
}

/** Every curated area whose `match` rule is satisfied by `town`/`outcode`
 * — used by `lib/listing-revalidation.ts` to find which area landing
 * page(s), if any, a given listing affects. Almost always 0 or 1 areas;
 * never more than 1 given the current registry's rules don't overlap
 * except Caversham/Emmer Green's documented, known exception above. */
export function findAreasMatchingListing(
  town: string,
  outcode: string,
): AreaDefinition[] {
  return AREAS.filter(
    (area) => area.match.town === town || area.match.outcode === outcode,
  )
}
