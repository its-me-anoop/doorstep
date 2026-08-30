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
 * Below `md` the compact bar collapses to a 44px icon. Expanding it
 * renders the combobox as a full-width second header row (in document
 * flow, via `basis-full` in the parent flex-wrap) so it pushes the
 * page — including breadcrumbs — down instead of overlaying them.
 */
export function HeaderSearch() {
  const pathname = usePathname()
  const [expanded, setExpanded] = useState(false)

  if (pathname === '/') return null

  const channel: Channel = pathname.startsWith('/to-rent') ? 'rent' : 'sale'

  return (
    <>
      <div className="hidden min-w-0 flex-1 justify-center px-2 md:flex">
        <div className="w-full max-w-[360px]">
          <SearchCombobox channel={channel} size="sm" />
        </div>
      </div>

      <button
        type="button"
        aria-label="Search"
        aria-expanded={expanded}
        onClick={() => setExpanded((value) => !value)}
        className="flex size-11 shrink-0 items-center justify-center md:hidden"
      >
        {expanded ? (
          <X aria-hidden="true" className="size-5" />
        ) : (
          <Search aria-hidden="true" className="size-5" />
        )}
      </button>

      {expanded && (
        <div
          data-testid="header-search-expanded"
          className="basis-full md:hidden"
        >
          <SearchCombobox channel={channel} size="sm" />
        </div>
      )}
    </>
  )
}
