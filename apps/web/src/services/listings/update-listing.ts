/**
 * UpdateListing — the use case behind PATCH /api/v1/listings/{id} (PRD
 * §6.5 LST-4). Object-level authorised via canManageListing (own listing,
 * or same-agency agent, or admin). Editable statuses are draft, rejected,
 * pending_review and published — see services/listings/errors.ts's
 * ListingNotEditableError doc comment for why under_offer is deliberately
 * excluded rather than assumed editable like published.
 *
 * Published edits carry the PRD §8.6 transactional guarantee: an outbox
 * upsert row (so search re-syncs within a minute) and, only when `price`
 * actually changes, a `listing_price_changed` events row — both written
 * atomically with the field update via
 * ListingWriter.updateWithSideEffects. Every other editable status uses
 * plain `update`: nothing about a draft/rejected/pending_review listing is
 * publicly visible, so there is no side effect to make atomic.
 */

import { canManageListing, ForbiddenError } from '@/services/authz/policies'

import type { DraftListingInput } from '@/lib/validation/listing'
import type {
  Listing,
  ListingReader,
  ListingSideEffects,
  ListingUpdateFields,
  ListingWriter,
} from '@/ports/listing-repository'
import type { PropertyStatus } from '@/domain/enums'
import type { User } from '@/ports/user-repository'

import { AccountSuspendedError } from '../auth/errors'
import { ListingChannelImmutableError, ListingNotEditableError } from './errors'
import { ListingNotFoundError } from '@/ports/listing-repository'

const EDITABLE_STATUSES: ReadonlySet<PropertyStatus> = new Set([
  'draft',
  'rejected',
  'pending_review',
  'published',
])

const VISIBLE_STATUSES: ReadonlySet<PropertyStatus> = new Set([
  'published',
  'under_offer',
])

export class UpdateListing {
  constructor(
    private readonly listingReader: ListingReader,
    private readonly listingWriter: ListingWriter,
  ) {}

  async execute(
    actor: User,
    listingId: string,
    changes: DraftListingInput,
  ): Promise<Listing> {
    if (actor.status !== 'active') {
      throw new AccountSuspendedError(actor.status)
    }

    const listing = await this.listingReader.findById(listingId)
    if (!listing) throw new ListingNotFoundError(listingId)

    if (!canManageListing(actor, listing)) {
      throw new ForbiddenError('You do not manage this listing')
    }

    // Immutable once the listing has left draft, not from creation: every
    // fresh draft is bootstrapped with a placeholder channel
    // (new-listing-redirect.tsx) before the user ever answers wizard step
    // 1 for real, and that real answer reaches the stored row through this
    // same PATCH. Rejecting a mismatch here for a still-draft listing
    // would silently strand the user's actual channel choice — see
    // ports/listing-repository.ts's ListingUpdateFields doc comment.
    if (listing.status !== 'draft' && changes.channel !== listing.channel) {
      throw new ListingChannelImmutableError()
    }

    if (!EDITABLE_STATUSES.has(listing.status)) {
      throw new ListingNotEditableError(listing.status)
    }

    const patch = this.toUpdateFields(changes)

    if (!VISIBLE_STATUSES.has(listing.status)) {
      return this.listingWriter.update(listingId, patch)
    }

    const sideEffects: ListingSideEffects = { outboxUpsert: true }
    if (patch.price !== undefined && patch.price !== listing.price) {
      sideEffects.priceChangeEvent = {
        previous: listing.price,
        next: patch.price,
      }
    }
    return this.listingWriter.updateWithSideEffects(
      listingId,
      patch,
      sideEffects,
    )
  }

  private toUpdateFields(changes: DraftListingInput): ListingUpdateFields {
    // `channel` is forwarded as-is (unlike title/slug/status, which
    // DraftListingInput never even carries) — the guard above already
    // ensures it's either unchanged or the listing is still a draft, so
    // by this point writing it is always safe.
    return changes
  }
}
