import Link from 'next/link'

import { buildPaginationItems } from '@/lib/pagination-items'
import { cn } from '@/lib/utils'

interface PaginationProps {
  page: number
  totalPages: number
  hrefForPage: (page: number) => string
  /** Fired instead of a real navigation on a plain left-click — the soft
   * `startTransition` nav §3.7 asks for. The `href` stays real (crawlable,
   * works with JS disabled) since this is a genuine `<a>`; only a plain
   * click is intercepted, so cmd/ctrl/middle-click still open a new tab
   * normally. */
  onSelect: (page: number) => void
}

const pageTargetClassName =
  'inline-flex min-h-11 min-w-11 items-center justify-center rounded-[var(--radius-sm)] text-sm font-medium'

function isPlainLeftClick(event: React.MouseEvent<HTMLAnchorElement>): boolean {
  return (
    event.button === 0 &&
    !event.metaKey &&
    !event.ctrlKey &&
    !event.shiftKey &&
    !event.altKey
  )
}

/**
 * Pagination — §3.7. Numbered, crawlable pages (never "load more"/infinite
 * scroll): every number is a real `<a href>`, `rel="prev"`/`rel="next"`
 * live in the page `<head>` (built by the page component itself, since
 * that's a document-level concern this component has no reach into).
 */
export function Pagination({
  page,
  totalPages,
  hrefForPage,
  onSelect,
}: PaginationProps) {
  if (totalPages <= 1) return null

  const items = buildPaginationItems(page, totalPages)

  function navigate(
    event: React.MouseEvent<HTMLAnchorElement>,
    target: number,
  ) {
    if (!isPlainLeftClick(event)) return
    event.preventDefault()
    onSelect(target)
  }

  return (
    <nav
      aria-label="Search results pages"
      className="flex items-center justify-center gap-1"
    >
      {page > 1 && (
        <Link
          href={hrefForPage(page - 1)}
          onClick={(event) => navigate(event, page - 1)}
          className={cn(
            pageTargetClassName,
            'text-foreground hover:bg-muted px-3',
          )}
        >
          Prev
        </Link>
      )}

      {items.map((item, index) =>
        item === 'ellipsis' ? (
          <span
            key={`ellipsis-${index}`}
            aria-hidden="true"
            className={cn(pageTargetClassName, 'text-muted-foreground')}
          >
            …
          </span>
        ) : item === page ? (
          <span
            key={item}
            aria-current="page"
            className={cn(
              pageTargetClassName,
              'bg-primary text-primary-foreground',
            )}
          >
            {item}
          </span>
        ) : (
          <Link
            key={item}
            href={hrefForPage(item)}
            onClick={(event) => navigate(event, item)}
            className={cn(
              pageTargetClassName,
              'text-foreground hover:bg-muted',
            )}
          >
            {item}
          </Link>
        ),
      )}

      {page < totalPages && (
        <Link
          href={hrefForPage(page + 1)}
          onClick={(event) => navigate(event, page + 1)}
          className={cn(
            pageTargetClassName,
            'text-foreground hover:bg-muted px-3',
          )}
        >
          Next
        </Link>
      )}
    </nav>
  )
}
