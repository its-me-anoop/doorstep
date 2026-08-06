/**
 * formatIsoDateLong — `YYYY-MM-DD` -> "1 September 2026". Shared by
 * components/features/search/filter-chips.tsx's "Available by {date}"
 * chip label (M2-DESIGN-SPEC.md §1.1) and the listing detail page's key
 * facts "Available from" row (§5.4) — the one date-display convention on
 * the buyer side, not a copy per caller.
 */
export function formatIsoDateLong(date: string): string {
  const parsed = new Date(`${date}T00:00:00`)
  if (Number.isNaN(parsed.getTime())) return date
  return new Intl.DateTimeFormat('en-GB', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  }).format(parsed)
}
