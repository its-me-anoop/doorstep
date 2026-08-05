/**
 * attachImageUrls — derives the public, cacheable URL for every variant
 * services/images/process-image.ts would have generated for a given
 * image (PRD §8.7 point 3), by re-running domain/image-variant-plan.ts's
 * planImageVariants over the stored `width` and asking ImageStorage for
 * each (width, format) pair's `variantImagePath`. Pure re-derivation, not
 * a stored list, for the same reason services/images/delete-image.ts
 * recomputes variant paths instead of persisting them: planImageVariants
 * is deterministic, so the same width always plans the same pairs that
 * were actually written when the image was processed.
 *
 * `PropertyImageEntity` itself only ever stores `storagePath` — the
 * private original, never served publicly (domain/image-storage-path.ts)
 * — so without this, nothing the wizard's photo grid (M1-DESIGN-SPEC.md
 * §1.5) or the review step's cover thumbnail could actually resolve to a
 * renderable `<img src>`. Shared by ProcessImage (the row just created)
 * and ListListingImages (every existing row) rather than each re-deriving
 * it inline.
 */

import { variantImagePath } from '@/domain/image-storage-path'
import { planImageVariants } from '@/domain/image-variant-plan'
import type { ImageStorage } from '@/ports/image-storage'
import type { PropertyImage } from '@/ports/property-image-repository'

export interface ImageVariantUrl {
  width: number
  format: 'webp' | 'avif'
  url: string
}

export interface PropertyImageWithUrls extends PropertyImage {
  urls: ImageVariantUrl[]
}

export async function attachImageUrls(
  image: PropertyImage,
  imageStorage: ImageStorage,
): Promise<PropertyImageWithUrls> {
  const urls = await Promise.all(
    planImageVariants(image.width).map(async ({ width, format }) => ({
      width,
      format,
      url: await imageStorage.publicUrl(
        variantImagePath(image.propertyId, image.id, width, format),
      ),
    })),
  )

  return { ...image, urls }
}
