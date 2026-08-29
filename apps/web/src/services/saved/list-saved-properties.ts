/**
 * ListSavedProperties — favourites page (PRD §6.3 ACC-2). Returns each
 * saved row with a minimal public-safe listing card, including listings
 * that have since left the market (badged via displayStatus).
 */

import { getDisplayStatus } from '@/domain/display-status'
import type { Channel, PropertyStatus } from '@/domain/enums'
import type { ListingReader } from '@/ports/listing-repository'
import type { PropertyImageReader } from '@/ports/property-image-repository'
import type { SavedPropertyRepository } from '@/ports/saved-property-repository'
import type { User } from '@/ports/user-repository'

import { AccountSuspendedError } from '../auth/errors'
import { SavedListingNotFoundError } from './errors'

export interface SavedPropertyCard {
  id: string
  slug: string
  title: string
  displayAddress: string
  price: number
  channel: Channel
  status: PropertyStatus
  displayStatus: string
  coverBlurhash: string | null
}

export interface SavedPropertyWithListing {
  savedAt: Date
  listing: SavedPropertyCard
}

export class ListSavedProperties {
  constructor(
    private readonly savedPropertyRepository: SavedPropertyRepository,
    private readonly listingReader: ListingReader,
    private readonly propertyImageReader: PropertyImageReader,
  ) {}

  async execute(actor: User): Promise<SavedPropertyWithListing[]> {
    if (actor.status !== 'active') {
      throw new AccountSuspendedError(actor.status)
    }

    const saved = await this.savedPropertyRepository.listByUser(actor.id)
    const results: SavedPropertyWithListing[] = []

    for (const row of saved) {
      const listing = await this.listingReader.findById(row.propertyId)
      if (!listing) {
        throw new SavedListingNotFoundError(row.propertyId)
      }

      const images = await this.propertyImageReader.listByProperty(listing.id)
      const cover = images.find((image) => image.position === 0)

      results.push({
        savedAt: row.createdAt,
        listing: {
          id: listing.id,
          slug: listing.slug,
          title: listing.title,
          displayAddress: listing.displayAddress,
          price: listing.price,
          channel: listing.channel,
          status: listing.status,
          displayStatus: getDisplayStatus(listing.status, listing.channel),
          coverBlurhash: cover?.blurhash ?? null,
        },
      })
    }

    return results
  }
}
