import type { ImageKind } from './enums'

/** The `property_images` entity (PRD §9.2). */
export interface PropertyImageEntity {
  id: string
  propertyId: string
  kind: ImageKind
  /** Original; variants derived by convention. */
  storagePath: string
  /** 0 = cover. */
  position: number
  width: number
  height: number
  blurhash: string
  altText: string | null
  createdAt: Date
  updatedAt: Date
}
