/**
 * DeleteAccount — GDPR account deletion (PRD §6.3 ACC-3): anonymise
 * enquiries, clear favourites and saved searches, hide or delete owned
 * listings, remove the Firebase user, then delete the app profile row.
 */

import type { PropertyStatus } from '@/domain/enums'
import type { AuthGateway } from '@/ports/auth-gateway'
import type { Clock } from '@/ports/clock'
import type { EnquiryWriter } from '@/ports/enquiry-repository'
import type {
  Listing,
  ListingReader,
  ListingWriter,
} from '@/ports/listing-repository'
import type { SavedPropertyRepository } from '@/ports/saved-property-repository'
import type { SavedSearchRepository } from '@/ports/saved-search-repository'
import type { User, UserRepository } from '@/ports/user-repository'

import { AccountSuspendedError } from '../auth/errors'

const LIVE_STATUSES: ReadonlySet<PropertyStatus> = new Set([
  'published',
  'under_offer',
])

export class DeleteAccount {
  constructor(
    private readonly userRepository: UserRepository,
    private readonly listingReader: ListingReader,
    private readonly listingWriter: ListingWriter,
    private readonly enquiryWriter: EnquiryWriter,
    private readonly savedPropertyRepository: SavedPropertyRepository,
    private readonly savedSearchRepository: SavedSearchRepository,
    private readonly authGateway: AuthGateway,
    private readonly clock: Clock,
  ) {}

  async execute(actor: User): Promise<void> {
    if (actor.status !== 'active') {
      throw new AccountSuspendedError(actor.status)
    }

    await this.enquiryWriter.anonymiseForUser(actor.id, actor.email)
    await this.savedPropertyRepository.deleteAllForUser(actor.id)
    await this.savedSearchRepository.deleteAllForUser(actor.id)

    await this.unpublishOwnedListings(actor.id)

    await this.authGateway.deleteUser(actor.firebaseUid)
    await this.userRepository.delete(actor.id)
  }

  private async unpublishOwnedListings(listerId: string): Promise<void> {
    let cursor: string | null = null
    do {
      const page = await this.listingReader.listByLister(listerId, {
        cursor,
        limit: 50,
      })
      for (const listing of page.data) {
        await this.handleListingOnDeletion(listing)
      }
      cursor = page.nextCursor
    } while (cursor)
  }

  private async handleListingOnDeletion(listing: Listing): Promise<void> {
    const now = this.clock.now()

    if (LIVE_STATUSES.has(listing.status)) {
      await this.listingWriter.transitionWithOutbox(listing.id, 'hidden', {
        statusChangedAt: now,
        outboxOp: 'delete',
      })
      return
    }

    if (listing.status === 'draft') {
      await this.listingWriter.delete(listing.id)
    }
  }
}
