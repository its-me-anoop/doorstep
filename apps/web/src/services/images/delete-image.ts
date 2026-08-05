/**
 * DeleteImage — the use case behind DELETE
 * /api/v1/listings/{id}/images/{imageId} (PRD §6.5 LST-3). Object-level
 * authorised via canManageListing, same scoping check as
 * ReorderImages/SetImageKind (an image belonging to a different listing
 * than the URL's is treated as not found).
 *
 * The property_images row is deleted first — if that fails, nothing else
 * happens and the caller sees the failure. Storage cleanup (the original
 * plus every variant domain/image-variant-plan.ts would have generated
 * for this image's stored width) is best-effort afterwards, via
 * Promise.allSettled: a storage delete failing does not roll back or fail
 * the request. Recomputing the variant paths from the stored width rather
 * than persisting a list of them works because planImageVariants is
 * deterministic — the same width always plans the same (width, format)
 * pairs that were written when this image was processed
 * (services/images/process-image.ts).
 */

import { planImageVariants, variantImagePath } from '@/domain'
import type { ImageStorage } from '@/ports/image-storage'
import {
  ListingNotFoundError,
  type ListingReader,
} from '@/ports/listing-repository'
import {
  PropertyImageNotFoundError,
  type PropertyImageReader,
  type PropertyImageWriter,
} from '@/ports/property-image-repository'
import type { User } from '@/ports/user-repository'
import { canManageListing, ForbiddenError } from '@/services/authz/policies'

import { AccountSuspendedError } from '../auth/errors'

export class DeleteImage {
  constructor(
    private readonly listingReader: ListingReader,
    private readonly propertyImageReader: PropertyImageReader,
    private readonly propertyImageWriter: PropertyImageWriter,
    private readonly imageStorage: ImageStorage,
  ) {}

  async execute(
    actor: User,
    listingId: string,
    imageId: string,
  ): Promise<void> {
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

    await this.propertyImageWriter.delete(imageId)

    const variantPaths = planImageVariants(image.width).map(
      ({ width, format }) =>
        variantImagePath(listingId, imageId, width, format),
    )
    await Promise.allSettled(
      [image.storagePath, ...variantPaths].map((path) =>
        this.imageStorage.delete(path),
      ),
    )
  }
}
