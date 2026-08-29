/**
 * ListModerationQueue — ADM-1 pending_review listings, oldest first.
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

export class ListModerationQueue {
  constructor(private readonly listingReader: ListingReader) {}

  async execute(
    actor: User,
    options: ListListingsOptions = {},
  ): Promise<ListingCursorPage<Listing>> {
    if (actor.status !== 'active') {
      throw new AccountSuspendedError(actor.status)
    }
    requireRole(actor, 'admin')

    return this.listingReader.listPendingReview(options)
  }
}
