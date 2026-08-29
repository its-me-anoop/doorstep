/**
 * SaveSearch — named filter set (PRD §6.1 SRCH-6 / §6.3). Alert
 * frequency stays 'none' in MVP — the repository sets that default.
 */

import type { SavedSearchCriteria } from '@/domain/saved'
import type {
  NewSavedSearch,
  SavedSearch,
  SavedSearchRepository,
} from '@/ports/saved-search-repository'
import type { User } from '@/ports/user-repository'

import { AccountSuspendedError } from '../auth/errors'

export class SaveSearch {
  constructor(private readonly savedSearchRepository: SavedSearchRepository) {}

  async execute(
    actor: User,
    name: string,
    criteria: SavedSearchCriteria,
  ): Promise<SavedSearch> {
    if (actor.status !== 'active') {
      throw new AccountSuspendedError(actor.status)
    }

    const input: NewSavedSearch = {
      userId: actor.id,
      name: name.trim(),
      criteria,
    }
    return this.savedSearchRepository.create(input)
  }
}
