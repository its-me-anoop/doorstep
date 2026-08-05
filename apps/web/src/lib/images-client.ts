/**
 * lib/images-client.ts — the browser-side calls behind the wizard's photo
 * step (PRD §6.5 LST-3, M1-DESIGN-SPEC.md §3.5/§1.5): request a signed
 * upload URL, PUT the file's bytes to it, ask the server to process the
 * upload, list/reorder/re-tag/delete a listing's images.
 *
 * Mirrors lib/listings-client.ts's shape (a typed error class + one
 * `request` helper unwrapping the `{ data } | { error }` envelope) rather
 * than importing that file's private helpers: the two are tiny (under 20
 * lines) and independently simple, and duplicating them keeps this module
 * free to evolve its own upload-specific error handling without touching
 * an already-shipped, already-tested file — the same "small, self-
 * contained duplication over a shared abstraction" call
 * services/images/reorder-images.ts's own doc comment makes for its
 * repeated lookup-then-authz block.
 *
 * `uploadOriginalBytes` is the one function here that isn't a JSON POST
 * through this envelope — it PUTs raw file bytes straight to the signed
 * URL RequestImageUpload returned (never through this app's own API), and
 * needs XMLHttpRequest rather than fetch() because only XHR exposes
 * upload progress events (M1-DESIGN-SPEC.md §1.5's per-tile progress
 * bar).
 */

import { IMAGE_KINDS, type ImageKind } from '@/domain/enums'

export class ImagesApiError extends Error {
  constructor(
    public readonly code: string,
    message: string,
  ) {
    super(message)
    this.name = 'ImagesApiError'
  }
}

const GENERIC_MESSAGE =
  'Something went wrong on our end — try again in a moment.'

interface ApiEnvelope<T> {
  data?: T
  error?: { code?: string; message?: string }
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(path, init)
  const json: ApiEnvelope<T> | null = await response.json().catch(() => null)

  if (!response.ok) {
    throw new ImagesApiError(
      json?.error?.code ?? 'internal_error',
      json?.error?.message ?? GENERIC_MESSAGE,
    )
  }

  return json?.data as T
}

export interface ImageVariantUrl {
  width: number
  format: 'webp' | 'avif'
  url: string
}

/** The wire shape of a processed image — the client's own view of
 * services/images/attach-image-urls.ts's `PropertyImageWithUrls`, typed
 * independently (dates as `string`, matching what actually crosses JSON,
 * rather than reusing the server's `Date`-typed port shape). */
export interface ListingImage {
  id: string
  propertyId: string
  kind: ImageKind
  position: number
  width: number
  height: number
  blurhash: string
  altText: string | null
  urls: ImageVariantUrl[]
}

export interface RequestImageUploadResponse {
  imageId: string
  uploadUrl: string
  path: string
  headers?: Record<string, string>
}

/** POST /api/v1/listings/{id}/images — mints the signed URL the very next
 * step PUTs the file's bytes to. */
export function requestImageUpload(
  listingId: string,
  input: { contentType: string; bytes: number },
): Promise<RequestImageUploadResponse> {
  return request<RequestImageUploadResponse>(
    `/api/v1/listings/${listingId}/images`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(input),
    },
  )
}

interface UploadOriginalBytesOptions {
  headers?: Record<string, string>
  onProgress?: (fraction: number) => void
}

/** PUTs `file`'s bytes directly to `uploadUrl` (never through this app's
 * own `/api/v1/*`) with the headers RequestImageUpload's signed URL
 * requires replayed, reporting fractional (0–1) progress as the browser's
 * `upload.progress` events fire (§1.5's per-tile progress bar). */
export function uploadOriginalBytes(
  uploadUrl: string,
  file: File,
  options: UploadOriginalBytesOptions = {},
): Promise<void> {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest()
    xhr.open('PUT', uploadUrl)
    for (const [key, value] of Object.entries(options.headers ?? {})) {
      xhr.setRequestHeader(key, value)
    }
    xhr.upload.onprogress = (event) => {
      if (!event.lengthComputable || !options.onProgress) return
      options.onProgress(event.loaded / event.total)
    }
    xhr.onload = () => {
      if (xhr.status >= 200 && xhr.status < 300) {
        resolve()
      } else {
        reject(new Error(`Upload failed with status ${xhr.status}`))
      }
    }
    xhr.onerror = () => reject(new Error('Upload failed'))
    xhr.send(file)
  })
}

/** POST /api/v1/listings/{id}/images/{imageId}/process — run once the PUT
 * above completes; the only place a real, listable image comes back. */
export function processListingImage(
  listingId: string,
  imageId: string,
): Promise<ListingImage> {
  return request<{ image: ListingImage }>(
    `/api/v1/listings/${listingId}/images/${imageId}/process`,
    { method: 'POST' },
  ).then(({ image }) => image)
}

/** GET /api/v1/listings/{id}/images — every image for the listing,
 * ordered by position (the wizard's photo-step mount/resume load). */
export function listListingImages(listingId: string): Promise<ListingImage[]> {
  return request<{ images: ListingImage[] }>(
    `/api/v1/listings/${listingId}/images`,
  ).then(({ images }) => images)
}

/** PATCH /api/v1/listings/{id}/images/{imageId} `{ position }` — drag or
 * keyboard reorder (§1.5); the server swaps positions with whichever
 * image currently occupies `position`, see
 * services/images/reorder-images.ts. */
export function setListingImagePosition(
  listingId: string,
  imageId: string,
  position: number,
): Promise<ListingImage> {
  return request<{ image: ListingImage }>(
    `/api/v1/listings/${listingId}/images/${imageId}`,
    {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ position }),
    },
  ).then(({ image }) => image)
}

/** PATCH /api/v1/listings/{id}/images/{imageId} `{ kind }` — tags a
 * freshly-processed image (always created as `kind: 'photo'`, see
 * services/images/process-image.ts) as the listing's floorplan or EPC
 * certificate slot. */
export function setListingImageKind(
  listingId: string,
  imageId: string,
  kind: ImageKind,
): Promise<ListingImage> {
  return request<{ image: ListingImage }>(
    `/api/v1/listings/${listingId}/images/${imageId}`,
    {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ kind }),
    },
  ).then(({ image }) => image)
}

/** DELETE /api/v1/listings/{id}/images/{imageId}. */
export async function deleteListingImage(
  listingId: string,
  imageId: string,
): Promise<void> {
  await request<{ deleted: true }>(
    `/api/v1/listings/${listingId}/images/${imageId}`,
    { method: 'DELETE' },
  )
}

// Re-exported so callers that only import from this client module (never
// touching @/domain directly) can still validate a `kind` value — kept
// here rather than duplicated, IMAGE_KINDS is the one runtime source.
export { IMAGE_KINDS }
