/**
 * Errors thrown by services/search/*. Same { name, ...context } shape as
 * services/listings/errors.ts and services/images/errors.ts, though
 * nothing maps this one to a route response yet — map-listing-to-search-
 * document.ts has no route calling it directly in this milestone (the
 * outbox drain worker that will is later work).
 */

import type { PropertyStatus } from '@/domain/enums'

/**
 * map-listing-to-search-document.ts rejects any listing whose status
 * isn't publicly visible (PRD §8.6: "Only publicly visible listings
 * (published, under offer) are indexed"). The (future) outbox drain
 * worker is expected to call the mapper only for `op: 'upsert'` outbox
 * rows, which per ports/listing-repository.ts's ListingSideEffects/
 * ListingTransitionOptions doc comments are themselves only ever written
 * while a listing is published/under_offer — so in practice this guards
 * against a caller bypassing that invariant, not a normal, expected
 * business case.
 */
export class NotIndexableListingError extends Error {
  readonly id: string
  readonly status: PropertyStatus

  constructor(id: string, status: PropertyStatus) {
    super(
      `Listing ${id} has status "${status}" and is not publicly visible — only published and under_offer listings are indexable`,
    )
    this.name = 'NotIndexableListingError'
    this.id = id
    this.status = status
  }
}
