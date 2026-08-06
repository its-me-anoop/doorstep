/**
 * Pure page-number layout for the results pagination control
 * (M2-DESIGN-SPEC.md §3.7): "up to 7 page numbers with … ellipsis
 * collapsing the middle on long result sets (1 2 3 … 9 10 style)."
 * Separated from the rendering component (pagination.tsx) so the
 * collapsing logic itself is trivially unit-testable without rendering
 * anything. One boundary page at each end, one sibling either side of
 * the current page — when the gap between a boundary and the sibling
 * window is exactly one page, that page renders directly instead of an
 * ellipsis (an ellipsis standing in for exactly one hidden page saves no
 * space), which is what gives the edge cases their "1 2 3 4 5 … 10"
 * shape rather than "1 … 3 4 5 … 10".
 */

export type PaginationItem = number | 'ellipsis'

const BOUNDARY_COUNT = 1
const SIBLING_COUNT = 1

function range(start: number, end: number): number[] {
  const items: number[] = []
  for (let value = start; value <= end; value++) items.push(value)
  return items
}

export function buildPaginationItems(
  page: number,
  totalPages: number,
): PaginationItem[] {
  if (totalPages <= 1) return [1]
  if (totalPages <= 2 * BOUNDARY_COUNT + 2 * SIBLING_COUNT + 3) {
    return range(1, totalPages)
  }

  const startPages = range(1, BOUNDARY_COUNT)
  const endPages = range(totalPages - BOUNDARY_COUNT + 1, totalPages)

  const siblingsStart = Math.max(
    Math.min(
      page - SIBLING_COUNT,
      totalPages - BOUNDARY_COUNT - 2 * SIBLING_COUNT - 1,
    ),
    BOUNDARY_COUNT + 2,
  )
  const siblingsEnd = Math.min(
    Math.max(page + SIBLING_COUNT, BOUNDARY_COUNT + 2 * SIBLING_COUNT + 2),
    totalPages - BOUNDARY_COUNT - 1,
  )

  const items: PaginationItem[] = [...startPages]

  items.push(
    ...(siblingsStart > BOUNDARY_COUNT + 2
      ? (['ellipsis'] as const)
      : range(BOUNDARY_COUNT + 1, siblingsStart - 1)),
  )

  items.push(...range(siblingsStart, siblingsEnd))

  items.push(
    ...(siblingsEnd < totalPages - BOUNDARY_COUNT - 1
      ? (['ellipsis'] as const)
      : range(siblingsEnd + 1, totalPages - BOUNDARY_COUNT)),
  )

  items.push(...endPages)

  return items
}
