/**
 * ListMyListings — the use case behind GET /api/v1/listings (PRD §10:
 * "My or my agency's listings"). Owner-only listings stay private to that
 * owner (listByLister); an agent's dashboard is agency-wide
 * (listByAgency) rather than just their own, mirroring
 * canManageListing's own same-agency rule (an agent already manages a
 * colleague's listing, so they see it here too).
 */

import type {
  Listing,
  ListingCursorPage,
  ListingReader,
  ListListingsOptions,
} from '@/ports/listing-repository'
import type { User } from '@/ports/user-repository'
import { requireRole } from '@/services/authz/policies'

import { AccountSuspendedError } from '../auth/errors'

export class ListMyListings {
  constructor(private readonly listingReader: ListingReader) {}

  async execute(
    actor: User,
    options: ListListingsOptions = {},
  ): Promise<ListingCursorPage<Listing>> {
    if (actor.status !== 'active') {
      throw new AccountSuspendedError(actor.status)
    }
    requireRole(actor, 'owner', 'agent')

    if (actor.role === 'agent' && actor.agencyId) {
      return this.listingReader.listByAgency(actor.agencyId, options)
    }
    return this.listingReader.listByLister(actor.id, options)
  }
}
