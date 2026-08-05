/**
 * Errors thrown by services/images/*. Route handlers catch these and map
 * them to the { error: { code, message } } envelope (PRD §8.5), same
 * pattern as services/listings/errors.ts.
 */

/** RequestImageUpload (PRD §6.5 LST-3: "Upload up to 25 images") rejects a
 * request once a listing already has `max` images. */
export class TooManyImagesError extends Error {
  readonly max: number

  constructor(max: number) {
    super(`A listing may have at most ${max} images`)
    this.name = 'TooManyImagesError'
    this.max = max
  }
}

/** ProcessImage (PRD §8.7 point 2) rejects a process call when nothing
 * has been PUT to the signed upload URL yet — the client is expected to
 * call this route only after its PUT to RequestImageUpload's uploadUrl
 * has completed. */
export class OriginalImageNotFoundError extends Error {
  readonly imageId: string

  constructor(imageId: string) {
    super(
      `No uploaded original found for image ${imageId} — upload it to the signed URL first`,
    )
    this.name = 'OriginalImageNotFoundError'
    this.imageId = imageId
  }
}
