import { formatPrice } from '@/domain/money'
import type { Listing } from '@/ports/listing-repository'

import { PROPERTY_TYPE_LABELS } from '../wizard/wizard-labels'
import { CoverThumbnail } from './cover-thumbnail'
import { RowActions } from './row-actions'
import { StatusBadge } from './status-badge'

interface ListingRowProps {
  listing: Listing
  /** This listing's position-0 image blurhash, or `null` — see
   * services/images/get-cover-blurhashes.ts's doc comment for why this
   * is blurhash-only, not a resolved photo URL. */
  coverBlurhash: string | null
  onListingChange: (listing: Listing) => void
  onDeleted: (listingId: string) => void
}

/**
 * ListingRow — one row of the my-listings dashboard's flowing list
 * (M1-DESIGN-SPEC.md §4.2): cover thumbnail, address + one formatted meta
 * line (REUSEs domain/money.ts's formatPrice — never a bespoke price
 * formatter), the status badge, and the per-status action matrix
 * (RowActions). A hairline `border-b` separates rows (§1.6: "no per-row
 * bordered/shadowed card"); actions wrap onto their own line on mobile
 * rather than compressing (§4.2 point 4).
 */
export function ListingRow({
  listing,
  coverBlurhash,
  onListingChange,
  onDeleted,
}: ListingRowProps) {
  const channelLabel = listing.channel === 'rent' ? 'To rent' : 'For sale'
  const metaLine = `${formatPrice(listing)} · ${channelLabel} · ${PROPERTY_TYPE_LABELS[listing.propertyType]}`

  return (
    <div
      aria-live="polite"
      className="border-border flex flex-wrap items-center gap-4 border-b py-4 last:border-b-0"
    >
      <CoverThumbnail blurhash={coverBlurhash} />

      <div className="min-w-0 flex-1">
        <p className="text-foreground truncate text-base font-medium">
          {listing.displayAddress}
        </p>
        <p className="text-muted-foreground text-sm">{metaLine}</p>
        {listing.status === 'rejected' && listing.rejectionReason && (
          <p className="bg-status-rejected-bg text-status-rejected-fg mt-2 rounded-[var(--radius-sm)] p-3 text-sm">
            {listing.rejectionReason}
          </p>
        )}
      </div>

      <StatusBadge status={listing.status} channel={listing.channel} />

      <div className="flex w-full justify-end sm:w-auto">
        <RowActions
          listing={listing}
          onListingChange={onListingChange}
          onDeleted={onDeleted}
        />
      </div>
    </div>
  )
}
