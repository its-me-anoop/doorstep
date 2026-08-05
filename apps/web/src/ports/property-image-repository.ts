/**
 * PropertyImageRepository, split per ISP like ListingRepository
 * (ports/listing-repository.ts): PropertyImageReader for the counts and
 * listings services/images/* need, PropertyImageWriter for the mutations
 * behind PRD §6.5 LST-3 ("upload up to 25 images, drag to reorder, set
 * cover, tag an image as floorplan or EPC").
 *
 * `PropertyImage` reuses domain/property-image.ts's `PropertyImageEntity`
 * directly — same reasoning ports/listing-repository.ts gives for reusing
 * `PropertyEntity`: this port needs essentially the whole
 * `property_images` row, so a port-local subset would just redeclare it.
 *
 * A row is only ever created once processing succeeds
 * (services/images/process-image.ts) — there is no "pending upload" row
 * (PRD §9.2 has no such column, and inventing one to model an in-flight
 * client upload the server hasn't verified yet would be state the schema
 * was never designed to hold). `NewPropertyImage.id` is therefore
 * required, not server-generated at insert time like every other table's
 * id: services/images/request-image-upload.ts mints it up front so the
 * same id can be embedded in the signed upload path AND become this row's
 * id once ProcessImage runs, letting the client's later
 * `.../images/{imageId}/...` calls address a row that exists by the time
 * they're made.
 */

import type { ImageKind } from '@/domain/enums'
import type { PropertyImageEntity } from '@/domain/property-image'

export type PropertyImage = PropertyImageEntity

export type NewPropertyImage = Omit<PropertyImage, 'createdAt' | 'updatedAt'>

export interface PropertyImageReader {
  findById(id: string): Promise<PropertyImage | null>
  /** Every image for a listing, ordered by `position` ascending — position
   * 0 is the cover (PRD §9.2). */
  listByProperty(propertyId: string): Promise<PropertyImage[]>
  countByProperty(propertyId: string): Promise<number>
  /** Same as `countByProperty`, restricted to one `kind`. Exists for the
   * 25-photo cap (PRD §6.5 LST-3, M1-DESIGN-SPEC.md §1.5): floorplan/EPC
   * are "each a single-purpose slot, not part of the 25-photo grid", so
   * the cap in services/images/request-image-upload.ts must count only
   * kind: 'photo' rows, not floorplan/EPC alongside them. */
  countByPropertyAndKind(propertyId: string, kind: ImageKind): Promise<number>
}

export interface PropertyImageWriter {
  create(image: NewPropertyImage): Promise<PropertyImage>
  updatePosition(id: string, position: number): Promise<PropertyImage>
  updateKind(id: string, kind: ImageKind): Promise<PropertyImage>
  delete(id: string): Promise<void>
}

/** Thrown by services/images/* (not by the writer methods themselves —
 * every write is preceded by a PropertyImageReader.findById the service
 * already needs for authz, mirroring
 * ports/listing-repository.ts's ListingNotFoundError doc comment) when a
 * requested image id does not exist. Route handlers map this to 404. */
export class PropertyImageNotFoundError extends Error {
  readonly id: string

  constructor(id: string) {
    super(`No property image with id ${id}`)
    this.name = 'PropertyImageNotFoundError'
    this.id = id
  }
}
