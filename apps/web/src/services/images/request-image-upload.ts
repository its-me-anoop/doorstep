/**
 * RequestImageUpload — the use case behind POST
 * /api/v1/listings/{id}/images (PRD §6.5 LST-3: "Uploads go directly to
 * storage via short-lived signed URLs"). Object-level authorised via
 * canManageListing, same as every services/listings/* mutation.
 *
 * Mints the image's id here — before any property_images row exists —
 * because the same id has to be embedded in the signed upload path AND
 * become the row's id once services/images/process-image.ts's later
 * `.../images/{imageId}/process` call succeeds (see
 * ports/property-image-repository.ts's doc comment). uuidv7(), not
 * crypto.randomUUID(), for the same reason
 * services/listings/create-listing-draft.ts generates its slug's
 * uniqueness seed inline rather than through a port: this is a one-line,
 * deterministic-enough-to-fake standard library call, not infrastructure
 * that needs swapping — and v7 keeps this id time-ordered like every
 * other row's id in this schema (schema.ts's idColumn).
 *
 * `input.bytes` (the client's declared upload size) is validated at the
 * route boundary (lib/validation/image.ts's requestImageUploadSchema)
 * but deliberately not read here — see that schema's doc comment for why
 * the signed URL is always constrained to the fixed MAX_IMAGE_BYTES
 * ceiling regardless of what the client claims.
 */

import { uuidv7 } from 'uuidv7'

import {
  MAX_IMAGES_PER_LISTING,
  MAX_IMAGE_BYTES,
  originalImagePath,
} from '@/domain'
import type { RequestImageUploadInput } from '@/lib/validation/image'
import type { ImageStorage } from '@/ports/image-storage'
import {
  ListingNotFoundError,
  type ListingReader,
} from '@/ports/listing-repository'
import type { PropertyImageReader } from '@/ports/property-image-repository'
import type { User } from '@/ports/user-repository'
import { canManageListing, ForbiddenError } from '@/services/authz/policies'

import { AccountSuspendedError } from '../auth/errors'
import { TooManyImagesError } from './errors'

/** How long the signed upload URL stays valid — long enough for a slow
 * mobile upload of a 15 MB photo, short enough that a leaked URL is
 * useless soon after (PRD §7.4: "short TTL"). */
const UPLOAD_URL_EXPIRES_IN_MS = 15 * 60_000

export interface RequestImageUploadResult {
  imageId: string
  uploadUrl: string
  path: string
  headers?: Record<string, string>
}

export class RequestImageUpload {
  constructor(
    private readonly listingReader: ListingReader,
    private readonly propertyImageReader: PropertyImageReader,
    private readonly imageStorage: ImageStorage,
  ) {}

  async execute(
    actor: User,
    listingId: string,
    input: RequestImageUploadInput,
  ): Promise<RequestImageUploadResult> {
    if (actor.status !== 'active') {
      throw new AccountSuspendedError(actor.status)
    }

    const listing = await this.listingReader.findById(listingId)
    if (!listing) throw new ListingNotFoundError(listingId)

    if (!canManageListing(actor, listing)) {
      throw new ForbiddenError('You do not manage this listing')
    }

    // Scoped to kind: 'photo' — floorplan/EPC are each a single-purpose
    // slot, not part of the 25-photo grid (M1-DESIGN-SPEC.md §1.5), so
    // they must not count against this cap.
    const existingPhotoCount =
      await this.propertyImageReader.countByPropertyAndKind(listingId, 'photo')
    if (existingPhotoCount >= MAX_IMAGES_PER_LISTING) {
      throw new TooManyImagesError(MAX_IMAGES_PER_LISTING)
    }

    const imageId = uuidv7()
    const path = originalImagePath(listingId, imageId)

    const signed = await this.imageStorage.createSignedUploadUrl(path, {
      contentType: input.contentType,
      maxBytes: MAX_IMAGE_BYTES,
      expiresInMs: UPLOAD_URL_EXPIRES_IN_MS,
    })

    return { imageId, uploadUrl: signed.url, path, headers: signed.headers }
  }
}
