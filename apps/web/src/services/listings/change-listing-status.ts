/**
 * ChangeListingStatus — the use case behind POST
 * /api/v1/listings/{id}/status (PRD §6.5 LST-5's one-click transitions:
 * sold_stc, let_agreed, complete, hide, unhide, back_on_market).
 * Object-level authorised via canManageListing, same as UpdateListing.
 *
 * Deliberately narrower than the full PRD §9.3 state machine: only the
 * five lister-triggered edges below are reachable through this service.
 * `assertTransition` (domain/property-status-machine.ts) is checked
 * first and throws InvalidTransitionError for anything structurally
 * impossible (e.g. draft -> completed); LISTER_TRANSITIONS is then
 * checked on top of that, and throws ForbiddenError for an edge that IS
 * structurally legal in the domain machine but belongs to the (M5,
 * unbuilt) admin approval flow — chiefly pending_review -> published,
 * reachable here only because 'unhide'/'back_on_market' both target
 * 'published' regardless of the listing's actual current status.
 *
 * Every reachable transition changes public visibility one way or the
 * other (PRD §8.6: published/under_offer are indexed, everything else
 * isn't), so every call here writes an outbox row — upsert or delete,
 * chosen from the target status alone. publishedAt is stamped only the
 * first time a listing reaches 'published' (PRD §9.2) — in practice that
 * already happened via the M5 admin-approval edge before any of these
 * five transitions become reachable, so this is a defensive no-op today,
 * kept because the port contract calls for it.
 */

import type { Channel, PropertyStatus } from '@/domain/enums'
import { assertTransition } from '@/domain/property-status-machine'
import type { Clock } from '@/ports/clock'
import type {
  Listing,
  ListingReader,
  ListingWriter,
} from '@/ports/listing-repository'
import { ListingNotFoundError } from '@/ports/listing-repository'
import type { User } from '@/ports/user-repository'
import { canManageListing, ForbiddenError } from '@/services/authz/policies'

import { AccountSuspendedError } from '../auth/errors'
import { ListingActionChannelMismatchError } from './errors'

export type ListingStatusAction =
  'sold_stc' | 'let_agreed' | 'complete' | 'hide' | 'unhide' | 'back_on_market'

const ACTION_TARGET_STATUS: Record<ListingStatusAction, PropertyStatus> = {
  sold_stc: 'under_offer',
  let_agreed: 'under_offer',
  complete: 'completed',
  hide: 'hidden',
  unhide: 'published',
  back_on_market: 'published',
}

/** Only actions meaningful for one specific channel appear here;
 * complete/hide/unhide/back_on_market apply to either channel. */
const ACTION_REQUIRED_CHANNEL: Partial<Record<ListingStatusAction, Channel>> = {
  sold_stc: 'sale',
  let_agreed: 'rent',
}

const LISTER_TRANSITIONS: ReadonlySet<string> = new Set([
  'published->under_offer',
  'under_offer->published',
  'under_offer->completed',
  'published->hidden',
  'hidden->published',
])

function isVisible(status: PropertyStatus): boolean {
  return status === 'published' || status === 'under_offer'
}

export class ChangeListingStatus {
  constructor(
    private readonly listingReader: ListingReader,
    private readonly listingWriter: ListingWriter,
    private readonly clock: Clock,
  ) {}

  async execute(
    actor: User,
    listingId: string,
    action: ListingStatusAction,
  ): Promise<Listing> {
    if (actor.status !== 'active') {
      throw new AccountSuspendedError(actor.status)
    }

    const listing = await this.listingReader.findById(listingId)
    if (!listing) throw new ListingNotFoundError(listingId)

    if (!canManageListing(actor, listing)) {
      throw new ForbiddenError('You do not manage this listing')
    }

    const requiredChannel = ACTION_REQUIRED_CHANNEL[action]
    if (requiredChannel && listing.channel !== requiredChannel) {
      throw new ListingActionChannelMismatchError(action, listing.channel)
    }

    const target = ACTION_TARGET_STATUS[action]
    assertTransition(listing.status, target)

    if (!LISTER_TRANSITIONS.has(`${listing.status}->${target}`)) {
      throw new ForbiddenError(
        `Action "${action}" from status "${listing.status}" requires admin approval`,
      )
    }

    const statusChangedAt = this.clock.now()
    const publishedAt =
      target === 'published' && listing.publishedAt === null
        ? statusChangedAt
        : undefined

    return this.listingWriter.transitionWithOutbox(listingId, target, {
      statusChangedAt,
      publishedAt,
      outboxOp: isVisible(target) ? 'upsert' : 'delete',
    })
  }
}
