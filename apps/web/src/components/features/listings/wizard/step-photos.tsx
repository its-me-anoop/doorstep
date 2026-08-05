'use client'

import type { ListingImage } from '@/lib/images-client'

import { PhotoGrid } from './photo-grid'
import { SingleSlotUploader } from './single-slot-uploader'
import type { ListingImagesStatus } from './use-listing-images'

interface StepPhotosProps {
  listingId: string
  images: ListingImage[]
  status: ListingImagesStatus
  onImageAdded: (image: ListingImage) => void
  onImagesReplaced: (images: ListingImage[]) => void
  onImageRemoved: (imageId: string) => void
}

/**
 * StepPhotos — wizard step 5 (M1-DESIGN-SPEC.md §3.5), replacing
 * step-photos-placeholder.tsx now upload is real. Owns nothing itself
 * beyond splitting the shared images list by `kind` and handing each
 * slice to the component that actually knows how to render it —
 * PhotoGrid for the up-to-25 photo grid, SingleSlotUploader (×2) for
 * Floorplan and EPC certificate.
 */
export function StepPhotos({
  listingId,
  images,
  status,
  onImageAdded,
  onImagesReplaced,
  onImageRemoved,
}: StepPhotosProps) {
  const photos = images.filter((image) => image.kind === 'photo')
  const floorplan = images.find((image) => image.kind === 'floorplan')
  const epc = images.find((image) => image.kind === 'epc')

  return (
    <div className="flex flex-col gap-12">
      <p className="text-muted-foreground max-w-[60ch] text-base leading-relaxed">
        Up to 25 photos, 15MB each. Drag to reorder, or use the arrows on each
        photo — the first photo is your cover image.
      </p>

      <section className="flex flex-col gap-4">
        <h3 className="text-[length:var(--text-h4)]">Photos</h3>
        {status === 'loading' ? (
          <p className="text-muted-foreground text-sm">Loading your photos…</p>
        ) : (
          <PhotoGrid
            listingId={listingId}
            photos={photos}
            onImageAdded={onImageAdded}
            onImagesReplaced={onImagesReplaced}
            onImageRemoved={onImageRemoved}
          />
        )}
      </section>

      <div className="grid grid-cols-1 gap-8 sm:grid-cols-2">
        <section className="flex flex-col gap-4">
          <h3 className="text-[length:var(--text-h4)]">Floorplan</h3>
          <SingleSlotUploader
            listingId={listingId}
            kind="floorplan"
            label="floorplan"
            image={floorplan}
            onImageAdded={onImageAdded}
            onImageRemoved={onImageRemoved}
          />
        </section>

        <section className="flex flex-col gap-4">
          <h3 className="text-[length:var(--text-h4)]">EPC certificate</h3>
          {/*
            M1-DESIGN-SPEC.md §1.5's own suggested copy says "you'll enter
            the rating itself in the next step" — but in this wizard's
            actual step order, the EPC *rating* field lives in step 3
            (Details), two steps *before* this one, not after. Naming it
            correctly here rather than shipping directional copy that
            would be wrong every time a lister reads it.
          */}
          <p className="text-muted-foreground max-w-[60ch] text-sm leading-relaxed">
            Upload the EPC certificate image (optional) — you&rsquo;ll find the
            energy rating field back in the Details step.
          </p>
          <SingleSlotUploader
            listingId={listingId}
            kind="epc"
            label="EPC certificate"
            image={epc}
            onImageAdded={onImageAdded}
            onImageRemoved={onImageRemoved}
          />
        </section>
      </div>
    </div>
  )
}
