/**
 * The curated area-slug table (M2-DESIGN-SPEC.md §1.7's "Area-page
 * resolution" table) — the search combobox's own "does this place
 * resolve to one of our curated areas" check (§1.9), so a common query
 * lands on the richer area landing page (app/(public)/for-sale/[area])
 * instead of the generic `/search` tier. Derived from `lib/areas.ts`'s
 * `AREAS` registry (the one place slug/label/match now live — see that
 * file's header comment for the town-vs-outcode matching decisions)
 * rather than a second, separately-maintained list: this module only
 * ever needed the **label-to-slug** slice of that registry.
 */

import { AREAS } from '@/lib/areas'

export interface CuratedArea {
  slug: string
  label: string
}

export const CURATED_AREAS: readonly CuratedArea[] = AREAS.map((area) => ({
  slug: area.slug,
  label: area.label,
}))

/** Exact (case-insensitive) match only — "Caversham" matches, "Caversham,
 * Reading" does not (§1.9: "unless the result's label matches a curated
 * area slug exactly"). Checked against both `name` (place suggestions
 * carry a short name distinct from their fuller `label`) and `label`,
 * since a postcode-fast-path result has no separate `name` field. */
export function matchCuratedArea(text: string): CuratedArea | undefined {
  const normalised = text.trim().toLowerCase()
  return CURATED_AREAS.find((area) => area.label.toLowerCase() === normalised)
}
