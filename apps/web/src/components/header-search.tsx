'use client'

import { Search, X } from 'lucide-react'
import { usePathname } from 'next/navigation'
import { useState } from 'react'

import type { Channel } from '@/domain/enums'
import { SearchCombobox } from '@/components/features/search/search-combobox'

/**
 * HeaderSearch — the site-header compact search affordance
 * (M2-DESIGN-SPEC.md §2.2). Absent on the homepage (its own hero already
 * carries the full-size box front and centre — a second one immediately
 * above it would be a redundant double-search); present, small-size, on
 * every other public page, defaulting to whichever channel the current
 * path implies (`/to-rent/...` → rent, everything else → sale) so a
 * header search from a rent results/detail page doesn't quietly switch
 * the visitor back to Buy.
 *
 * Below `md` the compact bar itself collapses to a single icon button
 * that expands the same combobox inline on tap (progressive disclosure,
 * not a modal/overlay) — a deliberate simplification of §2.2's "pushes
 * the wordmark row's height" full-width second-row behaviour: this
 * expands within the header's existing centred slot rather than adding
 * a dynamic second row, documented as a scope trim for this milestone.
 */
export function HeaderSearch() {
  const pathname = usePathname()
  const [expanded, setExpanded] = useState(false)

  if (pathname === '/') return null

  const channel: Channel = pathname.startsWith('/to-rent') ? 'rent' : 'sale'

  return (
    <div className="flex flex-1 items-center justify-center px-2">
      <div className="hidden w-full max-w-[360px] md:block">
        <SearchCombobox channel={channel} size="sm" />
      </div>

      <div className="flex w-full items-center justify-end md:hidden">
        <button
          type="button"
          aria-label="Search"
          aria-expanded={expanded}
          onClick={() => setExpanded((value) => !value)}
          className="flex size-11 items-center justify-center"
        >
          {expanded ? (
            <X aria-hidden="true" className="size-5" />
          ) : (
            <Search aria-hidden="true" className="size-5" />
          )}
        </button>
      </div>

      {expanded && (
        <div className="absolute inset-x-5 top-full mt-2 md:hidden">
          <SearchCombobox channel={channel} size="sm" />
        </div>
      )}
    </div>
  )
}
