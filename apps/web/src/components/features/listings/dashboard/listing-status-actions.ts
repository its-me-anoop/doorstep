/**
 * Client-side metadata for the dashboard's one-click status actions
 * (M1-DESIGN-SPEC.md §4.3/§4.4): what status each action leads to (needed
 * to paint the badge optimistically, before POST /status responds), its
 * button label, its past-tense confirmation copy, and — for the
 * consequential/visibility-changing actions — its legal inverse, if one
 * exists.
 *
 * `ACTION_TARGET_STATUS` deliberately mirrors
 * services/listings/change-listing-status.ts's own private map rather
 * than importing it: that file is server-only (canManageListing,
 * ForbiddenError, port types), and lib/validation/listing.ts's
 * changeListingStatusSchema doc comment already establishes this
 * codebase's precedent of accepting a literal duplicate of the
 * `ListingStatusAction` union over inventing a shared runtime source for
 * it. This mirror is UI-only knowledge for optimistic painting — the
 * server re-validates and is the only source of truth for whether a
 * transition is actually legal; a stale or wrong entry here would only
 * ever produce a wrong optimistic guess that the real POST's response
 * (or failure) corrects, never a security gap.
 *
 * `inverseAction` encodes the same "only where a legal inverse exists"
 * rule domain/property-status-machine.ts's TRANSITIONS table enforces:
 * `hide`'s inverse is `unhide` (hidden -> published is legal), and
 * `sold_stc`/`let_agreed`'s inverse is `back_on_market` (under_offer ->
 * published is legal) — but `complete` has none, because `completed`'s
 * only legal transition is to `archived` (terminal, matching §4.3's
 * "Completed: none — terminal until automatic archive"). `unhide` and
 * `back_on_market` are themselves the "reversible/already-safe" actions
 * (§4.4), so they have no inverse of their own either.
 */

import type { Channel, PropertyStatus } from '@/domain/enums'
import type { ListingStatusAction } from '@/services/listings/change-listing-status'

export const ACTION_TARGET_STATUS: Record<ListingStatusAction, PropertyStatus> =
  {
    sold_stc: 'under_offer',
    let_agreed: 'under_offer',
    complete: 'completed',
    hide: 'hidden',
    unhide: 'published',
    back_on_market: 'published',
  }

const ACTION_INVERSE: Partial<
  Record<ListingStatusAction, ListingStatusAction>
> = {
  sold_stc: 'back_on_market',
  let_agreed: 'back_on_market',
  hide: 'unhide',
}

export function inverseAction(
  action: ListingStatusAction,
): ListingStatusAction | null {
  return ACTION_INVERSE[action] ?? null
}

const CHANNEL_INDEPENDENT_BUTTON_LABEL: Partial<
  Record<ListingStatusAction, string>
> = {
  hide: 'Hide',
  unhide: 'Unhide',
  back_on_market: 'Back on market',
}

export function actionButtonLabel(
  action: ListingStatusAction,
  channel: Channel,
): string {
  if (action === 'sold_stc') return 'Mark Sold STC'
  if (action === 'let_agreed') return 'Mark Let Agreed'
  if (action === 'complete')
    return channel === 'rent' ? 'Mark Let' : 'Mark Sold'
  return CHANNEL_INDEPENDENT_BUTTON_LABEL[action] ?? action
}

const CHANNEL_INDEPENDENT_PAST_TENSE_LABEL: Partial<
  Record<ListingStatusAction, string>
> = {
  hide: 'Hidden from search.',
  unhide: 'Unhidden.',
  back_on_market: 'Back on the market.',
}

export function actionPastTenseLabel(
  action: ListingStatusAction,
  channel: Channel,
): string {
  if (action === 'sold_stc') return 'Marked Sold STC.'
  if (action === 'let_agreed') return 'Marked Let Agreed.'
  if (action === 'complete')
    return channel === 'rent' ? 'Marked let.' : 'Marked sold.'
  return CHANNEL_INDEPENDENT_PAST_TENSE_LABEL[action] ?? ''
}
