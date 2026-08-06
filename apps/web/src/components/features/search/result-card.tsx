import Link from 'next/link'

import { formatPrice } from '@/domain/money'
import { PROPERTY_TYPE_LABELS } from '@/components/features/listings/wizard/wizard-labels'
import type { PublicSearchHit } from '@/services/search/search-listings'

interface ResultCardProps {
  hit: PublicSearchHit
  /** Unix seconds "now" the New-this-week threshold is computed against
   * (§1.11) — a prop, not `Date.now()` read inline, so every card on one
   * render (and every card across a server/client re-render) agrees on
   * the same instant rather than each card evaluating a fractionally
   * different `now`. */
  now: number
}

const NEW_THIS_WEEK_SECONDS = 7 * 24 * 60 * 60

const PRIVATE_LABEL: Record<PublicSearchHit['channel'], string> = {
  sale: 'Private seller',
  rent: 'Private landlord',
}

function bedsBathsLine(hit: PublicSearchHit): string {
  const beds = `${hit.bedrooms} ${hit.bedrooms === 1 ? 'bed' : 'beds'}`
  const baths = `${hit.bathrooms} ${hit.bathrooms === 1 ? 'bath' : 'baths'}`
  return `${beds} · ${baths} · ${PROPERTY_TYPE_LABELS[hit.propertyType]}`
}

/**
 * The one badge slot on the cover photo (§1.8): the under-offer label
 * takes priority over New-this-week (a listing that's both recent and
 * under offer is more usefully flagged "Sold STC" than "New this
 * week" — the under-offer state is the more actionable thing for a
 * buyer scanning results to know), and the common case — neither —
 * renders no badge at all.
 */
function freshnessOrStatusBadge(
  hit: PublicSearchHit,
  now: number,
): string | null {
  if (hit.displayStatus !== 'published') return hit.displayStatus
  if (now - hit.publishedAt <= NEW_THIS_WEEK_SECONDS) return 'New this week'
  return null
}

/**
 * ResultCard — one search-results grid tile (M2-DESIGN-SPEC.md §1.8). No
 * nested card: the cover photo and content block are one flat unit, the
 * whole surface is a single link to the listing detail route. Blurhash
 * isn't available here — see this component's own note on
 * `coverImageUrl` below for why (a documented deviation from §1.10's
 * blurhash-first policy: `PublicSearchHit`, the frozen M2 backend
 * contract, carries the cover's already-optimised URL but no per-hit
 * blurhash, so the placeholder under the image is a flat `--paper-200`
 * tile rather than a blurhash-decoded swatch).
 */
export function ResultCard({ hit, now }: ResultCardProps) {
  const badge = freshnessOrStatusBadge(hit, now)
  const priceLine = formatPrice({
    channel: hit.channel,
    price: hit.price,
    priceQualifier: hit.priceQualifier,
  })

  return (
    <Link
      href={`/property/${hit.slug}`}
      className="border-border bg-card focus-visible:ring-ring block overflow-hidden rounded-[var(--radius-md)] border focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:outline-none"
    >
      <div className="bg-paper-200 relative aspect-[4/3]">
        {hit.coverImageUrl && (
          // eslint-disable-next-line @next/next/no-img-element -- a remote, already-optimised (sharp-generated) variant URL, not a local asset next/image would process (matches photo-tile.tsx's own precedent).
          <img
            src={hit.coverImageUrl}
            alt={hit.title}
            className="opacity-transition size-full object-cover"
          />
        )}

        {badge && (
          <span className="bg-badge-new-bg text-badge-new-fg absolute top-2 left-2 rounded-[var(--radius-sm)] px-2 py-0.5 text-xs font-medium">
            {badge}
          </span>
        )}

        {/* Reserved M4 save-heart slot (§1.8) — genuinely empty, not a
         * ghost icon, so the card's geometry never has to shift when the
         * real control lands. */}
        <div
          data-testid="card-action-slot"
          aria-hidden="true"
          className="absolute top-2 right-2 size-11"
        />
      </div>

      <div className="flex flex-col gap-1 p-4">
        <p className="text-foreground text-base font-medium">{priceLine}</p>
        <p className="text-muted-foreground text-sm">{hit.displayAddress}</p>
        <p className="text-muted-foreground text-sm">{bedsBathsLine(hit)}</p>
        {hit.agency ? (
          <p className="text-muted-foreground text-sm">{hit.agency.name}</p>
        ) : (
          <span className="bg-badge-private-bg text-badge-private-fg w-fit rounded-[var(--radius-sm)] px-2 py-0.5 text-xs font-medium">
            {PRIVATE_LABEL[hit.channel]}
          </span>
        )}
      </div>
    </Link>
  )
}
