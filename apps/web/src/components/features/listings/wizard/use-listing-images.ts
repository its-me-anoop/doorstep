'use client'

import { useCallback, useEffect, useState } from 'react'

import { listListingImages, type ListingImage } from '@/lib/images-client'

export type ListingImagesStatus = 'loading' | 'ready' | 'error'

export interface UseListingImagesResult {
  images: ListingImage[]
  status: ListingImagesStatus
  /** Appends a freshly-processed image (photo-grid.tsx / single-slot-
   * uploader.tsx's upload pipeline, after processListingImage resolves). */
  onImageAdded: (image: ListingImage) => void
  /** Applies one or more server-confirmed updates by id — a single
   * kind/position PATCH result, or the *two* images a reorder swap
   * changes (services/images/reorder-images.ts swaps positions with
   * whichever image occupied the target slot; the route only returns the
   * one requested, so the caller supplies both once it knows the
   * sibling's new position too). Unmatched images are left untouched. */
  onImagesReplaced: (images: ListingImage[]) => void
  /** Drops an image after a confirmed DELETE. */
  onImageRemoved: (imageId: string) => void
}

/**
 * useListingImages — the wizard photo step's single source of truth for
 * "what images does this listing have" (M1-DESIGN-SPEC.md §3.5): loads
 * once on mount via GET /api/v1/listings/{id}/images (there is no
 * client-side cache spanning navigations away from and back to the
 * wizard — see services/images/list-listing-images.ts's doc comment),
 * then exposes three primitive local mutations. Deliberately does not
 * itself call any mutating endpoint (PATCH/DELETE/upload) — those live in
 * photo-grid.tsx and single-slot-uploader.tsx, which call this hook's
 * setters only *after* their own API call succeeds, keeping "cache the
 * current list" and "perform a network mutation" as two separate
 * responsibilities.
 */
export function useListingImages(listingId: string): UseListingImagesResult {
  const [images, setImages] = useState<ListingImage[]>([])
  // Starts 'loading' as the initial state itself, rather than the effect
  // resetting it on every run (react-hooks/set-state-in-effect flags a
  // synchronous setState in an effect body) — `listingId` is fixed for
  // the lifetime of one wizard mount, so there is no "loading again"
  // transition this hook actually needs to model.
  const [status, setStatus] = useState<ListingImagesStatus>('loading')

  useEffect(() => {
    let cancelled = false
    listListingImages(listingId)
      .then((list) => {
        if (cancelled) return
        setImages(list)
        setStatus('ready')
      })
      .catch(() => {
        if (!cancelled) setStatus('error')
      })
    return () => {
      cancelled = true
    }
  }, [listingId])

  const onImageAdded = useCallback((image: ListingImage) => {
    setImages((prev) => [...prev, image])
  }, [])

  const onImagesReplaced = useCallback((updated: ListingImage[]) => {
    setImages((prev) =>
      prev.map(
        (image) =>
          updated.find((candidate) => candidate.id === image.id) ?? image,
      ),
    )
  }, [])

  const onImageRemoved = useCallback((imageId: string) => {
    setImages((prev) => prev.filter((image) => image.id !== imageId))
  }, [])

  return { images, status, onImageAdded, onImagesReplaced, onImageRemoved }
}
