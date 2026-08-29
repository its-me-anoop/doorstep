/**
 * DrizzleSavedSearchRepository — the SavedSearchRepository port
 * (ports/saved-search-repository.ts) implemented against `saved_searches`.
 */

import { eq } from 'drizzle-orm'

import type { SavedSearchCriteria } from '@/domain/saved'
import {
  SavedSearchNotFoundError,
  type NewSavedSearch,
  type SavedSearch,
  type SavedSearchRepository,
} from '@/ports/saved-search-repository'

import type { Db } from '../client'
import { savedSearches } from '../schema'

type SavedSearchRow = typeof savedSearches.$inferSelect

/** Maps a `saved_searches` table row to the port's `SavedSearch` shape.
 * Pure and DB-free, so it is unit-tested directly. */
export function mapRowToSavedSearch(row: SavedSearchRow): SavedSearch {
  return {
    id: row.id,
    userId: row.userId,
    name: row.name,
    criteria: row.criteria as SavedSearchCriteria,
    alertFrequency: row.alertFrequency,
    lastAlertedAt: row.lastAlertedAt,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  }
}

export class DrizzleSavedSearchRepository implements SavedSearchRepository {
  constructor(private readonly db: Db) {}

  async listByUser(userId: string): Promise<SavedSearch[]> {
    const rows = await this.db
      .select()
      .from(savedSearches)
      .where(eq(savedSearches.userId, userId))
      .orderBy(savedSearches.createdAt)
    return rows.map(mapRowToSavedSearch)
  }

  async findById(id: string): Promise<SavedSearch | null> {
    const [row] = await this.db
      .select()
      .from(savedSearches)
      .where(eq(savedSearches.id, id))
      .limit(1)
    return row ? mapRowToSavedSearch(row) : null
  }

  async create(search: NewSavedSearch): Promise<SavedSearch> {
    const [row] = await this.db
      .insert(savedSearches)
      .values({
        userId: search.userId,
        name: search.name,
        criteria: search.criteria,
      })
      .returning()
    if (!row) {
      throw new Error(
        'DrizzleSavedSearchRepository.create: insert returned no row',
      )
    }
    return mapRowToSavedSearch(row)
  }

  async delete(id: string): Promise<void> {
    const [row] = await this.db
      .delete(savedSearches)
      .where(eq(savedSearches.id, id))
      .returning({ id: savedSearches.id })
    if (!row) throw new SavedSearchNotFoundError(id)
  }

  async deleteAllForUser(userId: string): Promise<number> {
    const rows = await this.db
      .delete(savedSearches)
      .where(eq(savedSearches.userId, userId))
      .returning({ id: savedSearches.id })
    return rows.length
  }
}
