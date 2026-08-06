import type { Channel } from '@/domain/enums'
import type { PublicListingAgency } from '@/services/listings/get-public-listing'

interface ListerCardProps {
  channel: Channel
  /** The listing's own town — shown under the agency name for context
   * (agencies carry no separate "branch town" field, PRD §9.2; see this
   * file's own note below on why this isn't the agency's address). */
  town: string
  agency: PublicListingAgency | null
}

const PRIVATE_LABEL: Record<Channel, string> = {
  sale: 'Private seller',
  rent: 'Private landlord',
}

/**
 * ListerCard — M2-DESIGN-SPEC.md §5.7. The one legitimate bordered panel
 * on the detail page (the key facts block and description are plain
 * flow; this is the exception, a distinct skimmable unit of *who*, not
 * *what*).
 *
 * **Deviation from the spec's literal mock, stated once here:** §5.7
 * shows a "View agency profile →" link to `/agency/{slug}`. That public
 * agency page (PRD §10's separate GET /api/v1/agencies/{slug}) does not
 * exist anywhere in this codebase yet — this component follows the
 * spec's own explicit fallback for exactly that situation ("plain text
 * (no link) if it doesn't [exist], never a broken/dead link") rather
 * than rendering an inert "→" that goes nowhere. Revisit once
 * `/agency/[slug]` ships.
 *
 * **Reserved for M4** (phone-reveal + enquiry CTA, DET-4/ENQ-1): the
 * card's own `p-6` padding already gives those two rows room to append
 * without the card needing to be resized or restructured — nothing else
 * renders here in M2, per the same "no dead placeholder" rule already
 * applied to the media gallery's lightbox trigger and the location
 * section's map.
 */
export function ListerCard({ channel, town, agency }: ListerCardProps) {
  return (
    <div className="bg-card border-border rounded-[var(--radius-lg)] border p-6">
      {agency ? (
        <div className="flex items-center gap-3">
          {agency.logoUrl && (
            // eslint-disable-next-line @next/next/no-img-element -- a remote, already-optimised URL (same precedent as result-card.tsx's cover photo), not a local asset next/image would process.
            <img
              src={agency.logoUrl}
              alt={agency.name}
              className="size-10 shrink-0 rounded-[var(--radius-sm)] object-cover"
            />
          )}
          <div>
            <p className="text-foreground text-base font-medium">
              {agency.name}
            </p>
            <p className="text-muted-foreground text-sm">{town}</p>
          </div>
        </div>
      ) : (
        <span className="bg-badge-private-bg text-badge-private-fg rounded-[var(--radius-sm)] px-3 py-1 text-sm font-medium">
          {PRIVATE_LABEL[channel]}
        </span>
      )}
    </div>
  )
}
