/**
 * The storage path scheme for property images (PRD §8.7). Pure string
 * building, kept out of services/images/ and adapters/firebase/ so both
 * sides of the pipeline (the route that issues a signed upload URL, and
 * the processing step that reads the original back and writes variants)
 * derive the same paths from the same two ids instead of one of them
 * duplicating the convention.
 *
 * Originals are never served publicly (PRD §8.7 point 3) — only this
 * module's variant paths ever reach ImageStorage.publicUrl().
 */

export function originalImagePath(propertyId: string, imageId: string): string {
  return `listings/${propertyId}/original/${imageId}`
}

export type ImageVariantFormat = 'webp' | 'avif'

export function variantImagePath(
  propertyId: string,
  imageId: string,
  width: number,
  format: ImageVariantFormat,
): string {
  return `listings/${propertyId}/variants/${imageId}/${width}.${format}`
}
