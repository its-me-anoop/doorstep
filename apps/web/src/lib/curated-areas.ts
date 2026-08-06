/**
 * The curated area-slug table (M2-DESIGN-SPEC.md §1.7's "Area-page
 * resolution" table). Area landing pages themselves
 * (app/(public)/for-sale/{area}) are §4 — out of scope for this
 * milestone's commit, same as the listing detail route — but the search
 * combobox's own "does this place resolve to one of our curated areas"
 * check (§1.9) needs this table regardless, so a common query lands on
 * the (future) richer area page instead of the generic `/search` tier
 * once that route exists. Matching against the illustrative outcodes in
 * the spec's own table is explicitly flagged there as unverified against
 * postcodes.io/Royal Mail data — this module only encodes the
 * **label-to-slug** side (what the combobox needs), not the
 * town/outcode server-side matching §1.7 separately describes for the
 * area route itself.
 */

export interface CuratedArea {
  slug: string
  label: string
}

export const CURATED_AREAS: readonly CuratedArea[] = [
  { slug: 'reading', label: 'Reading' },
  { slug: 'caversham', label: 'Caversham' },
  { slug: 'tilehurst', label: 'Tilehurst' },
  { slug: 'earley', label: 'Earley' },
  { slug: 'woodley', label: 'Woodley' },
  { slug: 'emmer-green', label: 'Emmer Green' },
  { slug: 'wokingham', label: 'Wokingham' },
]

/** Exact (case-insensitive) match only — "Caversham" matches, "Caversham,
 * Reading" does not (§1.9: "unless the result's label matches a curated
 * area slug exactly"). Checked against both `name` (place suggestions
 * carry a short name distinct from their fuller `label`) and `label`,
 * since a postcode-fast-path result has no separate `name` field. */
export function matchCuratedArea(text: string): CuratedArea | undefined {
  const normalised = text.trim().toLowerCase()
  return CURATED_AREAS.find((area) => area.label.toLowerCase() === normalised)
}
