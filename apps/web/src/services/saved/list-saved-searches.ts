/**
 * ListSavedSearches — the signed-in user's saved filter sets.
 */

import type {
  SavedSearch,
  SavedSearchRepository,
} from '@/ports/saved-search-repository'
import type { User } from '@/ports/user-repository'

import { AccountSuspendedError } from '../auth/errors'

export class ListSavedSearches {
  constructor(private readonly savedSearchRepository: SavedSearchRepository) {}

  async execute(actor: User): Promise<SavedSearch[]> {
    if (actor.status !== 'active') {
      throw new AccountSuspendedError(actor.status)
    }

    return this.savedSearchRepository.listByUser(actor.id)
  }
}
