/**
 * Maps an internal PropertyStatus to the label shown to the public, per
 * PRD §9.2: "under_offer displays as Sold STC or Let Agreed by channel;
 * completed displays as Sold or Let." Every other status is shown as-is
 * (it only ever appears to the lister/admin, not the public).
 */

import type { Channel, PropertyStatus } from './enums'

const UNDER_OFFER_LABEL: Record<Channel, string> = {
  sale: 'Sold STC',
  rent: 'Let Agreed',
}

const COMPLETED_LABEL: Record<Channel, string> = {
  sale: 'Sold',
  rent: 'Let',
}

export function getDisplayStatus(
  status: PropertyStatus,
  channel: Channel,
): string {
  if (status === 'under_offer') return UNDER_OFFER_LABEL[channel]
  if (status === 'completed') return COMPLETED_LABEL[channel]
  return status
}
