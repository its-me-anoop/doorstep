/**
 * Pure constants and validation for the create-listing wizard's media
 * step (PRD §6.5 LST-3: "Upload up to 25 images (15 MB each)"). Consumed
 * by services/images/request-image-upload.ts (enforcement) and
 * lib/validation/image.ts (the request-body schema builds its content-type
 * enum directly from ALLOWED_IMAGE_CONTENT_TYPES, avoiding the duplicated-
 * literal-list pattern lib/validation/listing.ts uses for enums that only
 * exist as TS type unions — this one has a real runtime array to share).
 */

export const MAX_IMAGES_PER_LISTING = 25

export const MAX_IMAGE_BYTES = 15 * 1024 * 1024

export const ALLOWED_IMAGE_CONTENT_TYPES = [
  'image/jpeg',
  'image/png',
  'image/webp',
  'image/heic',
] as const

export type AllowedImageContentType =
  (typeof ALLOWED_IMAGE_CONTENT_TYPES)[number]

export function isAllowedImageContentType(
  contentType: string,
): contentType is AllowedImageContentType {
  return (ALLOWED_IMAGE_CONTENT_TYPES as readonly string[]).includes(
    contentType,
  )
}
