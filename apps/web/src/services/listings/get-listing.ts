/**
 * GetListing — the use case behind GET /api/v1/listings/{id} (PRD §10).
 * Object-level authorised via canManageListing, same rule as
 * UpdateListing/ChangeListingStatus: manager-only in M1. The public
 * detail page (by slug, unauthenticated, published/under_offer only) is
 * PRD §10's separate GET /api/v1/properties/{slug} — out of scope here,
 * lands in M2.
 */

import type { Listing, ListingReader } from '@/ports/listing-repository'
import { ListingNotFoundError } from '@/ports/listing-repository'
import type { User } from '@/ports/user-repository'
import { canManageListing, ForbiddenError } from '@/services/authz/policies'

import { AccountSuspendedError } from '../auth/errors'

export class GetListing {
  constructor(private readonly listingReader: ListingReader) {}

  async execute(actor: User, listingId: string): Promise<Listing> {
    if (actor.status !== 'active') {
      throw new AccountSuspendedError(actor.status)
    }

    const listing = await this.listingReader.findById(listingId)
    if (!listing) throw new ListingNotFoundError(listingId)

    if (!canManageListing(actor, listing)) {
      throw new ForbiddenError('You do not manage this listing')
    }

    return listing
  }
}
