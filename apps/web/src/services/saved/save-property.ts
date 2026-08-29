/**
 * SaveProperty — favourites (PRD §6.3 ACC-2). Idempotent via the port.
 */

import type { ListingReader } from '@/ports/listing-repository'
import { ListingNotFoundError } from '@/ports/listing-repository'
import type { SavedProperty, SavedPropertyRepository } from '@/ports/saved-property-repository'
import type { User } from '@/ports/user-repository'

import { AccountSuspendedError } from '../auth/errors'

export class SaveProperty {
  constructor(
    private readonly savedPropertyRepository: SavedPropertyRepository,
    private readonly listingReader: ListingReader,
  ) {}

  async execute(actor: User, propertyId: string): Promise<SavedProperty> {
    if (actor.status !== 'active') {
      throw new AccountSuspendedError(actor.status)
    }

    const listing = await this.listingReader.findById(propertyId)
    if (!listing) throw new ListingNotFoundError(propertyId)

    return this.savedPropertyRepository.save(actor.id, propertyId)
  }
}
