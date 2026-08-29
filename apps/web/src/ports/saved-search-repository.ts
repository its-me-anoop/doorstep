/**
 * SavedSearchRepository — named filter sets (PRD §6.1 SRCH-6 / §6.3,
 * domain/saved.ts). Alert frequency is always 'none' in MVP.
 */

import type { SavedSearchCriteria, SavedSearchEntity } from '@/domain/saved'

export type SavedSearch = SavedSearchEntity

export interface NewSavedSearch {
  userId: string
  name: string
  criteria: SavedSearchCriteria
}

export interface SavedSearchRepository {
  listByUser(userId: string): Promise<SavedSearch[]>
  findById(id: string): Promise<SavedSearch | null>
  create(search: NewSavedSearch): Promise<SavedSearch>
  delete(id: string): Promise<void>
  /** GDPR account deletion. */
  deleteAllForUser(userId: string): Promise<number>
}

export class SavedSearchNotFoundError extends Error {
  readonly searchId: string

  constructor(searchId: string) {
    super(`Saved search not found: ${searchId}`)
    this.name = 'SavedSearchNotFoundError'
    this.searchId = searchId
  }
}
