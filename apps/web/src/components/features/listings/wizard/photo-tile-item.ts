import type { ListingImage } from '@/lib/images-client'

/**
 * PhotoTileItem — the photo grid's one render model for every state a
 * tile can be in (M1-DESIGN-SPEC.md §1.5): a server-confirmed image, or
 * one still moving through the client-side upload pipeline
 * (request-upload -> PUT -> process). A discriminated union rather than
 * one object with optional fields, so photo-tile.tsx's render logic and
 * this file's own tests get exhaustiveness checking from the compiler.
 */
export type PhotoTileItem =
  | { status: 'ready'; image: ListingImage }
  | { status: 'uploading'; tempId: string; fileName: string; progress: number }
  | { status: 'processing'; tempId: string; fileName: string }
  | { status: 'error'; tempId: string; fileName: string; message: string }
