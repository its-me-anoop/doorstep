import { describe, expect, it } from 'vitest'

import { formatIsoDateLong } from '@/lib/format-date'

// Shared by the filter chips' "Available by {date}" label
// (M2-DESIGN-SPEC.md §1.1) and the listing detail page's key facts block
// (§5.4's "Available from" row) — one date-formatting convention, not
// two, now that a second consumer exists.
describe('formatIsoDateLong', () => {
  it('formats a YYYY-MM-DD string as "D Month YYYY"', () => {
    expect(formatIsoDateLong('2026-09-01')).toBe('1 September 2026')
  })

  it('returns the raw input unchanged if it does not parse as a date', () => {
    expect(formatIsoDateLong('not-a-date')).toBe('not-a-date')
  })
})
