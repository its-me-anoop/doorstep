import { describe, expect, it } from 'vitest'

import { buildPaginationItems } from '@/lib/pagination-items'

// M2-DESIGN-SPEC.md §3.7 — "up to 7 page numbers with … ellipsis
// collapsing the middle on long result sets (1 2 3 … 9 10 style)."
describe('buildPaginationItems', () => {
  it('shows every page when totalPages is small (no ellipsis needed)', () => {
    expect(buildPaginationItems(1, 5)).toEqual([1, 2, 3, 4, 5])
  })

  it('shows all 7 pages with no ellipsis at exactly 7 total pages', () => {
    expect(buildPaginationItems(4, 7)).toEqual([1, 2, 3, 4, 5, 6, 7])
  })

  it('collapses the tail with one ellipsis when near the start', () => {
    expect(buildPaginationItems(1, 10)).toEqual([1, 2, 3, 4, 5, 'ellipsis', 10])
  })

  it('collapses the head with one ellipsis when near the end', () => {
    expect(buildPaginationItems(10, 10)).toEqual([
      1,
      'ellipsis',
      6,
      7,
      8,
      9,
      10,
    ])
  })

  it('collapses both head and tail when current page is in the middle of a long list', () => {
    expect(buildPaginationItems(5, 10)).toEqual([
      1,
      'ellipsis',
      4,
      5,
      6,
      'ellipsis',
      10,
    ])
  })

  it('returns a single page for totalPages of 1', () => {
    expect(buildPaginationItems(1, 1)).toEqual([1])
  })
})
