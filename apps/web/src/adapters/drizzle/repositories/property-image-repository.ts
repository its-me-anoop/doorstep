/**
 * DrizzlePropertyImageRepository — the PropertyImageReader/
 * PropertyImageWriter ports (ports/property-image-repository.ts)
 * implemented against `property_images`, in the same shape as this
 * directory's other repositories: constructor-injected `Db` (DIP), a
 * pure row mapper exported and unit-tested directly, the class itself
 * exercised against a real Postgres instance in tests/integration/.
 *
 * `create()` inserts with the caller-supplied `id` rather than letting
 * the column default generate one — see ports/property-image-repository.ts's
 * doc comment for why (the id has to match what
 * services/images/request-image-upload.ts already embedded in the
 * client's storage path before this row exists).
 */

import { asc, count, eq } from 'drizzle-orm'

import type { ImageKind } from '@/domain/enums'
import {
  PropertyImageNotFoundError,
  type NewPropertyImage,
  type PropertyImage,
  type PropertyImageReader,
  type PropertyImageWriter,
} from '@/ports/property-image-repository'

import type { Db } from '../client'
import { propertyImages } from '../schema'

type PropertyImageRow = typeof propertyImages.$inferSelect

/** Maps a `property_images` table row to the port's `PropertyImage`
 * shape. Pure and DB-free, so it is unit-tested directly — see this
 * directory's other repositories for the same pattern. */
export function mapRowToPropertyImage(row: PropertyImageRow): PropertyImage {
  return {
    id: row.id,
    propertyId: row.propertyId,
    kind: row.kind,
    storagePath: row.storagePath,
    position: row.position,
    width: row.width,
    height: row.height,
    blurhash: row.blurhash,
    altText: row.altText,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  }
}

export class DrizzlePropertyImageRepository
  implements PropertyImageReader, PropertyImageWriter
{
  constructor(private readonly db: Db) {}

  async findById(id: string): Promise<PropertyImage | null> {
    const [row] = await this.db
      .select()
      .from(propertyImages)
      .where(eq(propertyImages.id, id))
      .limit(1)
    return row ? mapRowToPropertyImage(row) : null
  }

  async listByProperty(propertyId: string): Promise<PropertyImage[]> {
    const rows = await this.db
      .select()
      .from(propertyImages)
      .where(eq(propertyImages.propertyId, propertyId))
      .orderBy(asc(propertyImages.position))
    return rows.map(mapRowToPropertyImage)
  }

  async countByProperty(propertyId: string): Promise<number> {
    const [row] = await this.db
      .select({ value: count() })
      .from(propertyImages)
      .where(eq(propertyImages.propertyId, propertyId))
    return row?.value ?? 0
  }

  async create(image: NewPropertyImage): Promise<PropertyImage> {
    const [row] = await this.db
      .insert(propertyImages)
      .values({
        id: image.id,
        propertyId: image.propertyId,
        kind: image.kind,
        storagePath: image.storagePath,
        position: image.position,
        width: image.width,
        height: image.height,
        blurhash: image.blurhash,
        altText: image.altText,
      })
      .returning()
    if (!row) {
      throw new Error(
        'DrizzlePropertyImageRepository.create: insert returned no row',
      )
    }
    return mapRowToPropertyImage(row)
  }

  async updatePosition(id: string, position: number): Promise<PropertyImage> {
    const [row] = await this.db
      .update(propertyImages)
      .set({ position })
      .where(eq(propertyImages.id, id))
      .returning()
    if (!row) throw new PropertyImageNotFoundError(id)
    return mapRowToPropertyImage(row)
  }

  async updateKind(id: string, kind: ImageKind): Promise<PropertyImage> {
    const [row] = await this.db
      .update(propertyImages)
      .set({ kind })
      .where(eq(propertyImages.id, id))
      .returning()
    if (!row) throw new PropertyImageNotFoundError(id)
    return mapRowToPropertyImage(row)
  }

  async delete(id: string): Promise<void> {
    await this.db.delete(propertyImages).where(eq(propertyImages.id, id))
  }
}
