/**
 * SetImageKind — the `kind` half of PATCH
 * /api/v1/listings/{id}/images/{imageId} (PRD §6.5 LST-3: "tag an image
 * as floorplan or EPC"). Object-level authorised via canManageListing,
 * same as ReorderImages — see that file's doc comment for the
 * belongs-to-a-different-listing scoping check both services share.
 */

import type { ImageKind } from '@/domain/enums'
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

export class SetImageKind {
  constructor(
    private readonly listingReader: ListingReader,
    private readonly propertyImageReader: PropertyImageReader,
    private readonly propertyImageWriter: PropertyImageWriter,
  ) {}

  async execute(
    actor: User,
    listingId: string,
    imageId: string,
    kind: ImageKind,
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

    return this.propertyImageWriter.updateKind(imageId, kind)
  }
}
