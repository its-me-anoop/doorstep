'use client'

import { useState } from 'react'

import { MAX_IMAGES_PER_LISTING } from '@/domain'
import { ALLOWED_IMAGE_CONTENT_TYPES } from '@/domain/image-upload-policy'
import { runWithConcurrencyLimit } from '@/lib/concurrency-limit'
import { validateImageFile } from '@/lib/image-file-validation'
import {
  deleteListingImage,
  ImagesApiError,
  processListingImage,
  requestImageUpload,
  setListingImagePosition,
  uploadOriginalBytes,
  type ListingImage,
} from '@/lib/images-client'

import { PhotoTile } from './photo-tile'
import type { PhotoTileItem } from './photo-tile-item'

/** How many files upload concurrently when several are selected at once
 * (M1-DESIGN-SPEC.md §1.5) — small enough that a 25-photo bulk select
 * doesn't fire 25 simultaneous signed-upload requests, large enough that
 * a mobile upload isn't needlessly serialised one file at a time. */
const UPLOAD_CONCURRENCY = 3

const GENERIC_UPLOAD_ERROR = "Couldn't upload — try again"

interface UploadEntry {
  tempId: string
  file: File
  fileName: string
  phase: 'uploading' | 'processing' | 'error'
  progress: number
  message?: string
}

interface PhotoGridProps {
  listingId: string
  /** Every `kind: 'photo'` image already confirmed by the server —
   * StepPhotos filters the shared images list to this before passing it
   * down (floorplan/EPC are single-slot-uploader.tsx's concern). */
  photos: ListingImage[]
  onImageAdded: (image: ListingImage) => void
  onImagesReplaced: (images: ListingImage[]) => void
  onImageRemoved: (imageId: string) => void
}

function sortByPosition(photos: ListingImage[]): ListingImage[] {
  return [...photos].sort((a, b) => a.position - b.position)
}

let tempIdCounter = 0
function nextTempId(): string {
  tempIdCounter += 1
  return `upload-${tempIdCounter}`
}

/**
 * PhotoGrid — the "Photos" subsection of step 5 (M1-DESIGN-SPEC.md §1.5):
 * the drop zone/file picker, the up-to-25-photo grid combining
 * server-confirmed images with whatever is still mid-upload, and the
 * reorder (drag + the WCAG 2.5.7 keyboard alternative), make-cover and
 * remove actions.
 */
export function PhotoGrid({
  listingId,
  photos,
  onImageAdded,
  onImagesReplaced,
  onImageRemoved,
}: PhotoGridProps) {
  const [uploading, setUploading] = useState<UploadEntry[]>([])
  const [gridMessage, setGridMessage] = useState<string | null>(null)
  const [dragSourceId, setDragSourceId] = useState<string | null>(null)

  const sorted = sortByPosition(photos)
  const occupiedSlots =
    photos.length + uploading.filter((entry) => entry.phase !== 'error').length
  const remaining = MAX_IMAGES_PER_LISTING - occupiedSlots

  function updateEntry(tempId: string, patch: Partial<UploadEntry>) {
    setUploading((prev) =>
      prev.map((entry) =>
        entry.tempId === tempId ? { ...entry, ...patch } : entry,
      ),
    )
  }

  function removeEntry(tempId: string) {
    setUploading((prev) => prev.filter((entry) => entry.tempId !== tempId))
  }

  async function runPipeline(entry: UploadEntry) {
    try {
      const { imageId, uploadUrl, headers } = await requestImageUpload(
        listingId,
        { contentType: entry.file.type, bytes: entry.file.size },
      )
      await uploadOriginalBytes(uploadUrl, entry.file, {
        headers,
        onProgress: (fraction) =>
          updateEntry(entry.tempId, { progress: fraction }),
      })
      updateEntry(entry.tempId, { phase: 'processing' })
      const image = await processListingImage(listingId, imageId)
      removeEntry(entry.tempId)
      onImageAdded(image)
    } catch (error) {
      updateEntry(entry.tempId, {
        phase: 'error',
        message:
          error instanceof ImagesApiError
            ? error.message
            : GENERIC_UPLOAD_ERROR,
      })
    }
  }

  async function handleFilesSelected(fileList: FileList | null) {
    if (!fileList || fileList.length === 0) return
    const files = Array.from(fileList)

    const accepted = files.slice(0, Math.max(remaining, 0))
    const overflow = files.length - accepted.length
    setGridMessage(
      overflow > 0
        ? `You've reached the ${MAX_IMAGES_PER_LISTING}-photo limit — only ${accepted.length} more photo${accepted.length === 1 ? '' : 's'} could be added, ${overflow} left out.`
        : null,
    )

    const newEntries: UploadEntry[] = accepted.map((file) => {
      const validationError = validateImageFile(file)
      return {
        tempId: nextTempId(),
        file,
        fileName: file.name,
        phase: validationError ? 'error' : 'uploading',
        progress: 0,
        message: validationError ?? undefined,
      }
    })
    setUploading((prev) => [...prev, ...newEntries])

    await runWithConcurrencyLimit(
      newEntries.filter((entry) => entry.phase !== 'error'),
      UPLOAD_CONCURRENCY,
      (entry) => runPipeline(entry),
    )
  }

  function retry(entry: UploadEntry) {
    updateEntry(entry.tempId, {
      phase: 'uploading',
      progress: 0,
      message: undefined,
    })
    void runPipeline({ ...entry, phase: 'uploading', progress: 0 })
  }

  async function swapPositions(a: ListingImage, b: ListingImage) {
    if (a.id === b.id) return
    try {
      const updatedA = await setListingImagePosition(
        listingId,
        a.id,
        b.position,
      )
      onImagesReplaced([updatedA, { ...b, position: a.position }])
    } catch {
      setGridMessage("Couldn't reorder — try again.")
    }
  }

  function moveEarlier(image: ListingImage) {
    const index = sorted.findIndex((candidate) => candidate.id === image.id)
    if (index > 0) void swapPositions(image, sorted[index - 1]!)
  }

  function moveLater(image: ListingImage) {
    const index = sorted.findIndex((candidate) => candidate.id === image.id)
    if (index !== -1 && index < sorted.length - 1) {
      void swapPositions(image, sorted[index + 1]!)
    }
  }

  function makeCover(image: ListingImage) {
    const first = sorted[0]
    if (first) void swapPositions(image, first)
  }

  async function removePhoto(image: ListingImage) {
    try {
      await deleteListingImage(listingId, image.id)
      onImageRemoved(image.id)
    } catch {
      setGridMessage("Couldn't remove that photo — try again.")
    }
  }

  const readyItems: { key: string; image: ListingImage }[] = sorted.map(
    (image) => ({
      key: image.id,
      image,
    }),
  )

  return (
    <div className="flex flex-col gap-4">
      {sorted.length === 0 && uploading.length === 0 ? (
        <p className="text-muted-foreground max-w-[60ch] text-sm leading-relaxed">
          Add photos of every room, plus the front of the property. Listings
          with 10 or more photos get noticeably more enquiries — aim for at
          least 6 to start.
        </p>
      ) : null}

      {(sorted.length > 0 || uploading.length > 0) && (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4">
          {readyItems.map(({ key, image }, index) => {
            const item: PhotoTileItem = { status: 'ready', image }
            return (
              <PhotoTile
                key={key}
                item={item}
                isCover={index === 0}
                canMoveEarlier={index > 0}
                canMoveLater={index < readyItems.length - 1}
                onMakeCover={() => makeCover(image)}
                onMoveEarlier={() => moveEarlier(image)}
                onMoveLater={() => moveLater(image)}
                onRemove={() => void removePhoto(image)}
                onDragStart={() => setDragSourceId(image.id)}
                onDropOnto={() => {
                  if (dragSourceId && dragSourceId !== image.id) {
                    const source = photos.find((p) => p.id === dragSourceId)
                    if (source) void swapPositions(source, image)
                  }
                  setDragSourceId(null)
                }}
              />
            )
          })}

          {uploading.map((entry) => {
            const item: PhotoTileItem =
              entry.phase === 'error'
                ? {
                    status: 'error',
                    tempId: entry.tempId,
                    fileName: entry.fileName,
                    message: entry.message ?? GENERIC_UPLOAD_ERROR,
                  }
                : entry.phase === 'processing'
                  ? {
                      status: 'processing',
                      tempId: entry.tempId,
                      fileName: entry.fileName,
                    }
                  : {
                      status: 'uploading',
                      tempId: entry.tempId,
                      fileName: entry.fileName,
                      progress: entry.progress,
                    }
            return (
              <PhotoTile
                key={entry.tempId}
                item={item}
                isCover={false}
                canMoveEarlier={false}
                canMoveLater={false}
                onRetry={() => retry(entry)}
              />
            )
          })}
        </div>
      )}

      {remaining > 0 ? (
        <label className="border-input hover:border-primary flex cursor-pointer flex-col gap-1 rounded-[var(--radius-md)] border border-dashed p-4">
          <input
            type="file"
            multiple
            accept={ALLOWED_IMAGE_CONTENT_TYPES.join(',')}
            aria-label="Add photos"
            className="sr-only"
            onChange={(event) => {
              void handleFilesSelected(event.target.files)
              event.target.value = ''
            }}
          />
          <span className="text-foreground text-sm font-medium">
            {sorted.length === 0 && uploading.length === 0
              ? 'Add photos'
              : 'Add more photos'}
          </span>
          <span className="text-muted-foreground text-xs">
            Up to {MAX_IMAGES_PER_LISTING} photos, 15MB each.
          </span>
        </label>
      ) : (
        <p className="text-muted-foreground text-xs">
          You&rsquo;ve added the maximum of {MAX_IMAGES_PER_LISTING} photos.
        </p>
      )}

      {gridMessage && (
        <p role="alert" className="text-destructive text-sm">
          {gridMessage}
        </p>
      )}
    </div>
  )
}
