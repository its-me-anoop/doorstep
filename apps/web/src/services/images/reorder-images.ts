/**
 * ReorderImages — the `position` half of PATCH
 * /api/v1/listings/{id}/images/{imageId} (PRD §6.5 LST-3: "drag to
 * reorder, set cover" — position 0 is the cover, PRD §9.2). Object-level
 * authorised via canManageListing, same as every services/listings/* and
 * services/images/* mutation, plus an extra scoping check
 * (`image.propertyId !== listingId`) that treats an image belonging to a
 * *different* listing as not found rather than leaking whether the id
 * exists at all — the same not-found-not-forbidden choice a 404 makes
 * everywhere else in this API for an id a route's URL doesn't own.
 *
 * Reordering is a position *swap*, not a full re-index of every image:
 * moving image A onto the slot image B currently occupies exchanges their
 * two position values, leaving every other image's position untouched.
 * Moving onto an unoccupied slot (e.g. beyond the current highest
 * position) just sets the position directly — nothing to swap with.
 */

import {
  ListingNotFoundError,
  type ListingReader,
} from '@/ports/listing-repository'
import {
  PropertyImageNotFoundError,
  type PropertyImage,
  type PropertyImageReader,
  type PropertyImageWriter,
} from '@/ports/property-image-repository'
import type { User } from '@/ports/user-repository'
import { canManageListing, ForbiddenError } from '@/services/authz/policies'

import { AccountSuspendedError } from '../auth/errors'

export class ReorderImages {
  constructor(
    private readonly listingReader: ListingReader,
    private readonly propertyImageReader: PropertyImageReader,
    private readonly propertyImageWriter: PropertyImageWriter,
  ) {}

  async execute(
    actor: User,
    listingId: string,
    imageId: string,
    newPosition: number,
  ): Promise<PropertyImage> {
    if (actor.status !== 'active') {
      throw new AccountSuspendedError(actor.status)
    }

    const listing = await this.listingReader.findById(listingId)
    if (!listing) throw new ListingNotFoundError(listingId)

    if (!canManageListing(actor, listing)) {
      throw new ForbiddenError('You do not manage this listing')
    }

    const image = await this.propertyImageReader.findById(imageId)
    if (!image || image.propertyId !== listingId) {
      throw new PropertyImageNotFoundError(imageId)
    }

    if (image.position === newPosition) return image

    const siblings = await this.propertyImageReader.listByProperty(listingId)
    const occupant = siblings.find(
      (sibling) => sibling.position === newPosition,
    )

    if (occupant) {
      await this.propertyImageWriter.updatePosition(occupant.id, image.position)
    }

    return this.propertyImageWriter.updatePosition(imageId, newPosition)
  }
}
