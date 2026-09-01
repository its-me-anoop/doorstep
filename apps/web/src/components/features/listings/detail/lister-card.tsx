import type { Channel } from '@/domain/enums'
import type { PublicListingAgency } from '@/services/listings/get-public-listing'

import { ListerCardActions } from './lister-card-actions'

interface ListerCardProps {
  propertyId: string
  channel: Channel
  town: string
  agency: PublicListingAgency | null
  signedIn: boolean
  defaultName?: string
  defaultEmail?: string
  defaultPhone?: string | null
  turnstileSiteKey?: string
}

const PRIVATE_LABEL: Record<Channel, string> = {
  sale: 'Private seller',
  rent: 'Private landlord',
}

export function ListerCard({
  propertyId,
  channel,
  town,
  agency,
  signedIn,
  defaultName,
  defaultEmail,
  defaultPhone,
  turnstileSiteKey,
}: ListerCardProps) {
  return (
    <div className="bg-card border-border rounded-[var(--radius-lg)] border p-6">
      {agency ? (
        <div className="flex items-center gap-3">
          {agency.logoUrl && (
            // eslint-disable-next-line @next/next/no-img-element
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

      <ListerCardActions
        propertyId={propertyId}
        signedIn={signedIn}
        defaultName={defaultName}
        defaultEmail={defaultEmail}
        defaultPhone={defaultPhone}
        contactPhone={agency?.contactPhone}
        turnstileSiteKey={turnstileSiteKey}
      />
    </div>
  )
}
