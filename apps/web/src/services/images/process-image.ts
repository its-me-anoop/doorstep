/**
 * ProcessImage — the use case behind POST
 * /api/v1/listings/{id}/images/{imageId}/process (PRD §8.7 point 2), run
 * by the client immediately after its PUT to RequestImageUpload's
 * uploadUrl completes. Object-level authorised via canManageListing, same
 * as every services/listings/* and services/images/* mutation.
 *
 * The only place a property_images row is created (PRD §9.2 has no
 * "pending upload" column — see ports/property-image-repository.ts's doc
 * comment) — a row only starts existing once processing succeeds.
 *
 * Pipeline, all via sharp (PRD §8.7 point 2):
 *  1. Read the original back from ImageStorage. A single get() doubles
 *     as "verify the object exists" (a null result IS "does not exist")
 *     — cheaper than a separate exists() + get() round trip, and no less
 *     informative: OriginalImageNotFoundError either way.
 *  2. `.rotate().toBuffer({resolveWithObject: true})` bakes any EXIF
 *     orientation into the pixels and returns the corrected width/height
 *     in one call — sharp's default re-encode strips all other metadata
 *     (EXIF, GPS, ICC aside from sRGB conversion) too, satisfying PRD
 *     §7.4's "EXIF stripped on processing" without any extra step.
 *  3. domain/blurhash.ts's computeBlurhash over a raw RGBA decode of a
 *     32px-max thumbnail (PRD §8.7's "computes a blurhash placeholder").
 *  4. domain/image-variant-plan.ts's planImageVariants decides which
 *     (width, format) pairs to render from the corrected width; each is
 *     resized and encoded, then written to ImageStorage under
 *     domain/image-storage-path.ts's variantImagePath.
 *  5. The property_images row is inserted with `position` set to
 *     whatever propertyImageReader.countByProperty currently reports —
 *     there is a small race window if two uploads for the same listing
 *     finish processing at the same instant (both could read the same
 *     count and land on the same position), deliberately not closed here
 *     for M1: no other write path in this codebase's repositories
 *     computes a position/order value inside the database itself either
 *     (services own that decision, repositories just persist it — see
 *     e.g. services/listings/create-listing-draft.ts deriving `slug`
 *     before calling the writer), and a rare duplicate position is a
 *     display-order glitch the lister can fix with a drag-reorder, not a
 *     data-integrity problem.
 */

import sharp from 'sharp'

import {
  computeBlurhash,
  originalImagePath,
  planImageVariants,
  variantImagePath,
} from '@/domain'
import type { ImageStorage } from '@/ports/image-storage'
import {
  ListingNotFoundError,
  type ListingReader,
} from '@/ports/listing-repository'
import type {
  PropertyImage,
  PropertyImageReader,
  PropertyImageWriter,
} from '@/ports/property-image-repository'
import type { User } from '@/ports/user-repository'
import { canManageListing, ForbiddenError } from '@/services/authz/policies'

import { AccountSuspendedError } from '../auth/errors'
import { OriginalImageNotFoundError } from './errors'

/** The square box a blurhash's source thumbnail is fit inside (PRD §8.7:
 * "a 32px raw" decode). */
const BLURHASH_THUMBNAIL_SIZE = 32
const WEBP_QUALITY = 80
const AVIF_QUALITY = 60

export class ProcessImage {
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
  ): Promise<PropertyImage> {
    if (actor.status !== 'active') {
      throw new AccountSuspendedError(actor.status)
    }

    const listing = await this.listingReader.findById(listingId)
    if (!listing) throw new ListingNotFoundError(listingId)

    if (!canManageListing(actor, listing)) {
      throw new ForbiddenError('You do not manage this listing')
    }

    const originalPath = originalImagePath(listingId, imageId)
    const originalBytes = await this.imageStorage.get(originalPath)
    if (!originalBytes) throw new OriginalImageNotFoundError(imageId)

    const { data: corrected, info } = await sharp(originalBytes)
      .rotate()
      .toBuffer({ resolveWithObject: true })

    const blurhash = await this.computeBlurhashFor(corrected)

    await Promise.all(
      planImageVariants(info.width).map(({ width, format }) =>
        this.renderAndStoreVariant(
          corrected,
          listingId,
          imageId,
          width,
          format,
        ),
      ),
    )

    const position = await this.propertyImageReader.countByProperty(listingId)

    return this.propertyImageWriter.create({
      id: imageId,
      propertyId: listingId,
      kind: 'photo',
      storagePath: originalPath,
      position,
      width: info.width,
      height: info.height,
      blurhash,
      altText: null,
    })
  }

  private async computeBlurhashFor(corrected: Buffer): Promise<string> {
    const { data, info } = await sharp(corrected)
      .resize(BLURHASH_THUMBNAIL_SIZE, BLURHASH_THUMBNAIL_SIZE, {
        fit: 'inside',
      })
      .ensureAlpha()
      .raw()
      .toBuffer({ resolveWithObject: true })

    return computeBlurhash(new Uint8ClampedArray(data), info.width, info.height)
  }

  private async renderAndStoreVariant(
    corrected: Buffer,
    listingId: string,
    imageId: string,
    width: number,
    format: 'webp' | 'avif',
  ): Promise<void> {
    const resized = sharp(corrected).resize({ width })
    const bytes =
      format === 'webp'
        ? await resized.webp({ quality: WEBP_QUALITY }).toBuffer()
        : await resized.avif({ quality: AVIF_QUALITY }).toBuffer()

    await this.imageStorage.put(
      variantImagePath(listingId, imageId, width, format),
      new Uint8Array(bytes),
      `image/${format}`,
    )
  }
}
