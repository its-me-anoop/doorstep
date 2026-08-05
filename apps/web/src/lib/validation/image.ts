/**
 * Zod schemas for the image pipeline's two request bodies (PRD §6.5 LST-3,
 * §10). Both content-type allow-list and size ceiling come from
 * domain/image-upload-policy.ts rather than being redeclared here — a
 * real runtime array/constant exists at that layer (unlike
 * lib/validation/listing.ts's CHANNEL/PROPERTY_TYPE, which duplicate a TS
 * type union because there is nothing to import there).
 *
 * `requestImageUploadSchema.bytes` is the client's *declared* upload
 * size, validated here only for early, friendly rejection of an
 * obviously-too-big file before a signed URL is even issued —
 * services/images/request-image-upload.ts does not forward it to
 * ImageStorage.createSignedUploadUrl. The real security boundary is that
 * call's own `maxBytes`, always MAX_IMAGE_BYTES regardless of what the
 * client claims here (PRD §7.4: constraints enforced server-side, never
 * trusting the client) — a request whose `bytes` lies about being small
 * still can't upload more than MAX_IMAGE_BYTES, because GCS enforces the
 * signed URL's X-Goog-Content-Length-Range independent of this field.
 */

import { z } from 'zod'

import { IMAGE_KINDS } from '@/domain/enums'
import {
  ALLOWED_IMAGE_CONTENT_TYPES,
  MAX_IMAGE_BYTES,
} from '@/domain/image-upload-policy'

export const requestImageUploadSchema = z.object({
  contentType: z.enum(ALLOWED_IMAGE_CONTENT_TYPES),
  bytes: z.number().int().positive().max(MAX_IMAGE_BYTES),
})

export const updateImageSchema = z
  .object({
    position: z.number().int().min(0).optional(),
    kind: z.enum(IMAGE_KINDS).optional(),
  })
  .refine((data) => data.position !== undefined || data.kind !== undefined, {
    message: 'Provide at least one of position or kind.',
  })

export type RequestImageUploadInput = z.infer<typeof requestImageUploadSchema>
export type UpdateImageInput = z.infer<typeof updateImageSchema>
