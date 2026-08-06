'use client'

import { X } from 'lucide-react'
import Link from 'next/link'

import { formatPrice } from '@/domain/money'
import { PROPERTY_TYPE_LABELS } from '@/components/features/listings/wizard/wizard-labels'
import type { PublicSearchHit } from '@/services/search/search-listings'

interface MiniCardProps {
  hit: PublicSearchHit
  onClose: () => void
}

function bedsTypeLine(hit: PublicSearchHit): string {
  const beds = `${hit.bedrooms} ${hit.bedrooms === 1 ? 'bed' : 'beds'}`
  return `${beds} · ${PROPERTY_TYPE_LABELS[hit.propertyType]}`
}

/**
 * MiniCard — §1.4's condensed `ResultCard`. Rendered in two different
 * hosts by map-view.tsx (a MapLibre/Mapbox `Popup` on desktop via
 * `setDOMContent`, §2.4; a docked bottom panel on mobile, §3.3) — this
 * component itself doesn't know or care which, it's the one shared
 * content implementation either way, matching the spec's explicit
 * "content exactly §1.4" instruction rather than two hand-built
 * templates.
 *
 * DOM shape is load-bearing (§1.4's own stated nested-interactive-
 * element warning): the close `[×]` is a *sibling* `<button>`, never
 * nested inside the `<a>` — only the thumb+text block is the link.
 */
export function MiniCard({ hit, onClose }: MiniCardProps) {
  const priceLine = formatPrice({
    channel: hit.channel,
    price: hit.price,
    priceQualifier: hit.priceQualifier,
  })

  return (
    <div
      className="mini-card bg-card border-border relative w-[280px] rounded-[var(--radius-md)] border"
      role="group"
      aria-label={`${priceLine}, ${hit.displayAddress}`}
    >
      <button
        type="button"
        aria-label="Close"
        onClick={onClose}
        className="text-muted-foreground hover:text-foreground absolute top-2 right-2 flex size-11 items-center justify-center"
      >
        <X aria-hidden="true" className="size-4" />
      </button>

      <Link href={`/property/${hit.slug}`} className="flex gap-3 p-3 pr-11">
        <div className="bg-paper-200 relative aspect-[4/3] w-[88px] shrink-0 overflow-hidden rounded-[var(--radius-sm)]">
          {hit.coverImageUrl && (
            // eslint-disable-next-line @next/next/no-img-element -- a remote, already-optimised (sharp-generated) variant URL, matching result-card.tsx's own precedent.
            <img
              src={hit.coverImageUrl}
              alt={hit.title}
              className="size-full object-cover"
            />
          )}
        </div>

        <div className="flex min-w-0 flex-col gap-0.5">
          <p className="text-foreground text-sm font-medium">{priceLine}</p>
          <p className="text-muted-foreground truncate text-sm">
            {hit.displayAddress}
          </p>
          <p className="text-muted-foreground text-sm">{bedsTypeLine(hit)}</p>
        </div>
      </Link>
    </div>
  )
}
