/**
 * ListListingImages — the use case behind GET /api/v1/listings/{id}/images
 * (PRD §6.5 LST-3). The wizard's photo step (M1-DESIGN-SPEC.md §3.5) needs
 * to reload a draft's already-processed images whenever it mounts — there
 * is no client-side cache spanning navigations away from and back to the
 * wizard, so without this the grid would forget every photo on resume.
 * Object-level authorised via canManageListing, same rule as every other
 * services/images/* use case.
 *
 * Returns every image regardless of `kind` (photo, floorplan, epc),
 * ordered by position ascending (PropertyImageReader.listByProperty's own
 * contract) — StepPhotos splits that one list into its three subsections
 * client-side, the same division of labour ReorderImages/SetImageKind
 * leave to their route rather than folding routing decisions into a
 * service.
 */

import {
  ListingNotFoundError,
  type ListingReader,
} from '@/ports/listing-repository'
import type { PropertyImageReader } from '@/ports/property-image-repository'
import type { ImageStorage } from '@/ports/image-storage'
import type { User } from '@/ports/user-repository'
import { canManageListing, ForbiddenError } from '@/services/authz/policies'

import { AccountSuspendedError } from '../auth/errors'
import {
  attachImageUrls,
  type PropertyImageWithUrls,
} from './attach-image-urls'

export class ListListingImages {
  constructor(
    private readonly listingReader: ListingReader,
    private readonly propertyImageReader: PropertyImageReader,
    private readonly imageStorage: ImageStorage,
  ) {}

  async execute(
    actor: User,
    listingId: string,
  ): Promise<PropertyImageWithUrls[]> {
    if (actor.status !== 'active') {
      throw new AccountSuspendedError(actor.status)
    }

    const listing = await this.listingReader.findById(listingId)
    if (!listing) throw new ListingNotFoundError(listingId)

    if (!canManageListing(actor, listing)) {
      throw new ForbiddenError('You do not manage this listing')
    }

    const images = await this.propertyImageReader.listByProperty(listingId)
    return Promise.all(
      images.map((image) => attachImageUrls(image, this.imageStorage)),
    )
  }
}
