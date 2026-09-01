/**
 * DrizzleSavedPropertyRepository — the SavedPropertyRepository port
 * (ports/saved-property-repository.ts) implemented against
 * `saved_properties`.
 */

import { and, eq } from 'drizzle-orm'

import type {
  SavedProperty,
  SavedPropertyRepository,
} from '@/ports/saved-property-repository'

import type { Db } from '../client'
import { savedProperties } from '../schema'

type SavedPropertyRow = typeof savedProperties.$inferSelect

/** Maps a `saved_properties` table row to the port's `SavedProperty`
 * shape. Pure and DB-free, so it is unit-tested directly. */
export function mapRowToSavedProperty(row: SavedPropertyRow): SavedProperty {
  return {
    userId: row.userId,
    propertyId: row.propertyId,
    createdAt: row.createdAt,
  }
}

export class DrizzleSavedPropertyRepository implements SavedPropertyRepository {
  constructor(private readonly db: Db) {}

  async listByUser(userId: string): Promise<SavedProperty[]> {
    const rows = await this.db
      .select()
      .from(savedProperties)
      .where(eq(savedProperties.userId, userId))
      .orderBy(savedProperties.createdAt)
    return rows.map(mapRowToSavedProperty)
  }

  async isSaved(userId: string, propertyId: string): Promise<boolean> {
    const [row] = await this.db
      .select({ userId: savedProperties.userId })
      .from(savedProperties)
      .where(
        and(
          eq(savedProperties.userId, userId),
          eq(savedProperties.propertyId, propertyId),
        ),
      )
      .limit(1)
    return row !== undefined
  }

  async save(userId: string, propertyId: string): Promise<SavedProperty> {
    const [row] = await this.db
      .insert(savedProperties)
      .values({ userId, propertyId })
      .onConflictDoNothing()
      .returning()
    if (row) return mapRowToSavedProperty(row)

    const [existing] = await this.db
      .select()
      .from(savedProperties)
      .where(
        and(
          eq(savedProperties.userId, userId),
          eq(savedProperties.propertyId, propertyId),
        ),
      )
      .limit(1)
    if (!existing) {
      throw new Error(
        'DrizzleSavedPropertyRepository.save: insert returned no row and no existing pair found',
      )
    }
    return mapRowToSavedProperty(existing)
  }

  async unsave(userId: string, propertyId: string): Promise<void> {
    await this.db
      .delete(savedProperties)
      .where(
        and(
          eq(savedProperties.userId, userId),
          eq(savedProperties.propertyId, propertyId),
        ),
      )
  }

  async deleteAllForUser(userId: string): Promise<number> {
    const rows = await this.db
      .delete(savedProperties)
      .where(eq(savedProperties.userId, userId))
      .returning({ userId: savedProperties.userId })
    return rows.length
  }
}
