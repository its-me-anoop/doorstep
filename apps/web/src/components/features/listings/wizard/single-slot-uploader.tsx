'use client'

import { useRef, useState } from 'react'

import type { ImageKind } from '@/domain/enums'
import { ALLOWED_IMAGE_CONTENT_TYPES } from '@/domain/image-upload-policy'
import { validateImageFile } from '@/lib/image-file-validation'
import {
  deleteListingImage,
  ImagesApiError,
  processListingImage,
  requestImageUpload,
  setListingImageKind,
  uploadOriginalBytes,
  type ListingImage,
} from '@/lib/images-client'

type SlotPhase = 'idle' | 'uploading' | 'processing' | 'error'

const GENERIC_UPLOAD_ERROR = "Couldn't upload — try again"

interface SingleSlotUploaderProps {
  listingId: string
  kind: Extract<ImageKind, 'floorplan' | 'epc'>
  /** The human label used in copy — "floorplan" / "EPC certificate". */
  label: string
  image: ListingImage | undefined
  onImageAdded: (image: ListingImage) => void
  onImageRemoved: (imageId: string) => void
}

/**
 * SingleSlotUploader — the Floorplan/EPC certificate slots
 * (M1-DESIGN-SPEC.md §1.5): a single-purpose upload/replace affordance,
 * not part of the 25-photo grid. Reuses the same three-call upload
 * pipeline photo-grid.tsx runs (request -> PUT -> process), then tags the
 * result with `kind` — services/images/process-image.ts always creates a
 * fresh row as `kind: 'photo'`, so the tag is this component's own PATCH,
 * not something the pipeline does for it.
 */
export function SingleSlotUploader({
  listingId,
  kind,
  label,
  image,
  onImageAdded,
  onImageRemoved,
}: SingleSlotUploaderProps) {
  const [phase, setPhase] = useState<SlotPhase>('idle')
  const [progress, setProgress] = useState(0)
  const [message, setMessage] = useState<string | null>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  const actionLabel = image ? 'Change' : `Add ${label}`
  const inputAccessibleName = image ? `Change ${label}` : `Add ${label}`

  async function handleFile(file: File) {
    const validationError = validateImageFile(file)
    if (validationError) {
      setPhase('error')
      setMessage(validationError)
      return
    }

    setPhase('uploading')
    setProgress(0)
    setMessage(null)
    try {
      const { imageId, uploadUrl, headers } = await requestImageUpload(
        listingId,
        { contentType: file.type, bytes: file.size },
      )
      await uploadOriginalBytes(uploadUrl, file, {
        headers,
        onProgress: setProgress,
      })
      setPhase('processing')
      const processed = await processListingImage(listingId, imageId)
      const tagged = await setListingImageKind(listingId, processed.id, kind)
      onImageAdded(tagged)
      setPhase('idle')

      if (image) {
        try {
          await deleteListingImage(listingId, image.id)
          onImageRemoved(image.id)
        } catch {
          // The replacement already succeeded and is visible; leaving the
          // superseded original as an orphaned row is a storage-cleanup
          // gap, not a UX failure worth surfacing here.
        }
      }
    } catch (error) {
      setPhase('error')
      setMessage(
        error instanceof ImagesApiError ? error.message : GENERIC_UPLOAD_ERROR,
      )
    }
  }

  async function handleRemove() {
    if (!image) return
    try {
      await deleteListingImage(listingId, image.id)
      onImageRemoved(image.id)
    } catch {
      setPhase('error')
      setMessage("Couldn't remove that — try again.")
    }
  }

  const thumbnailUrl = image?.urls[0]?.url

  return (
    <div className="flex flex-col gap-2">
      <input
        ref={inputRef}
        type="file"
        accept={ALLOWED_IMAGE_CONTENT_TYPES.join(',')}
        aria-label={inputAccessibleName}
        className="sr-only"
        onChange={(event) => {
          const file = event.target.files?.[0]
          event.target.value = ''
          if (file) void handleFile(file)
        }}
      />

      {phase === 'uploading' || phase === 'processing' ? (
        <div
          className={`bg-paper-200 relative aspect-[4/3] w-full max-w-40 overflow-hidden rounded-[var(--radius-sm)] ${
            phase === 'processing' ? 'photo-tile-processing' : ''
          }`}
        >
          {phase === 'uploading' && (
            <div
              role="progressbar"
              aria-label={`Uploading ${label}`}
              aria-valuenow={Math.round(progress * 100)}
              aria-valuemin={0}
              aria-valuemax={100}
              className="absolute inset-x-0 bottom-0 h-1"
            >
              <div
                className="h-full origin-left bg-[var(--clay-500)] transition-transform duration-200 ease-out"
                style={{ transform: `scaleX(${progress})` }}
              />
            </div>
          )}
          {phase === 'processing' && (
            <p className="photo-tile-processing-label text-muted-foreground absolute inset-0 flex items-center justify-center text-xs">
              Processing…
            </p>
          )}
        </div>
      ) : image && thumbnailUrl ? (
        <div className="flex items-center gap-3">
          {/* eslint-disable-next-line @next/next/no-img-element -- a remote, already-optimised variant URL, not a local asset. */}
          <img
            src={thumbnailUrl}
            alt={`${label} preview`}
            className="aspect-[4/3] w-24 rounded-[var(--radius-sm)] object-cover"
          />
          <div className="flex flex-col items-start gap-1">
            <button
              type="button"
              onClick={() => inputRef.current?.click()}
              className="text-primary text-sm"
            >
              Change
            </button>
            <button
              type="button"
              onClick={() => void handleRemove()}
              className="text-muted-foreground text-sm"
            >
              Remove
            </button>
          </div>
        </div>
      ) : (
        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          className="border-input hover:border-primary rounded-[var(--radius-sm)] border border-dashed px-3 py-6 text-left text-sm"
        >
          {actionLabel}
        </button>
      )}

      {phase === 'error' && message && (
        <p role="alert" className="text-destructive text-sm">
          {message}
        </p>
      )}
    </div>
  )
}
