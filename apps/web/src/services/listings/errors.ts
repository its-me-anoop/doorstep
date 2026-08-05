/**
 * Errors thrown by services/listings/*. Route handlers catch these and map
 * them to the { error: { code, message } } envelope (PRD §8.5 — thin
 * handlers), same pattern as services/auth/errors.ts.
 */

import type { Channel, PropertyStatus } from '@/domain/enums'

/**
 * UpdateListing (PRD §6.5 LST-4) rejects an edit to a listing whose status
 * isn't draft, rejected, pending_review or published — completed, hidden
 * and archived listings are edit-locked. under_offer is deliberately in
 * this locked set too even though it is publicly visible like published:
 * the task defining this service enumerated exactly
 * {draft, rejected, pending_review, published} as editable and did not
 * include under_offer, so — for a listing that is, by definition, already
 * under offer — this errs conservative rather than assuming the omission
 * was accidental. Revisit if product wants under-offer edits allowed.
 */
export class ListingNotEditableError extends Error {
  readonly status: PropertyStatus

  constructor(status: PropertyStatus) {
    super(`Listing with status "${status}" cannot be edited`)
    this.name = 'ListingNotEditableError'
    this.status = status
  }
}

/**
 * UpdateListing rejects any PATCH whose validated `channel` does not match
 * the stored listing's channel — channel (sale/rent) is immutable after
 * creation (ports/listing-repository.ts's ListingUpdateFields excludes it
 * from the writer entirely). Rejecting a mismatch explicitly, rather than
 * silently ignoring the client's `channel` value, closes a subtler gap:
 * lib/validation/listing.ts's price-range check validates `price` against
 * whatever `channel` the request body claims, so a request claiming the
 * wrong channel could otherwise sail through a price bound meant for the
 * listing's real channel.
 */
export class ListingChannelImmutableError extends Error {
  constructor() {
    super('Listing channel cannot be changed after creation')
    this.name = 'ListingChannelImmutableError'
  }
}

/**
 * SubmitListing (PRD §9.2) rejects a draft/rejected -> pending_review
 * transition when the stored listing fails
 * lib/validation/listing.ts's submitListingSchema. `issues` mirrors zod's
 * own issue shape (path joined with '.', plus message) so a route/UI can
 * point at the exact missing field.
 */
export class ListingIncompleteError extends Error {
  readonly issues: ReadonlyArray<{ path: string; message: string }>

  constructor(issues: ReadonlyArray<{ path: string; message: string }>) {
    super('Listing is missing required fields for submission')
    this.name = 'ListingIncompleteError'
    this.issues = issues
  }
}

/**
 * DeleteListing (M1-DESIGN-SPEC.md §4.3/§4.4: "Delete draft" is the one
 * irreversible, non-transition dashboard action, offered only on a draft
 * row) rejects a delete of any listing whose status isn't `draft` —
 * hiding/archiving is a status transition, not a substitute for deleting
 * a draft that was never worth keeping. There is no DELETE affordance in
 * the PRD for a listing that has ever left draft; once real moderation or
 * public history exists for it, the visibility-transition actions
 * (hide/archive) are the only way to remove it from view.
 */
export class ListingNotDeletableError extends Error {
  readonly status: PropertyStatus

  constructor(status: PropertyStatus) {
    super(`Listing with status "${status}" cannot be deleted`)
    this.name = 'ListingNotDeletableError'
    this.status = status
  }
}

/**
 * ChangeListingStatus (PRD §6.5 LST-5) rejects `sold_stc` on a rent
 * listing and `let_agreed` on a sale listing — each action is only
 * meaningful for its own channel.
 */
export class ListingActionChannelMismatchError extends Error {
  readonly action: string
  readonly channel: Channel

  constructor(action: string, channel: Channel) {
    super(`Action "${action}" is not valid for a "${channel}" listing`)
    this.name = 'ListingActionChannelMismatchError'
    this.action = action
    this.channel = channel
  }
}
