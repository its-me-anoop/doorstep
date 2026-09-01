/**
 * DeleteSavedSearch — remove a saved filter set owned by the actor.
 */

import {
  SavedSearchNotFoundError,
  type SavedSearchRepository,
} from '@/ports/saved-search-repository'
import type { User } from '@/ports/user-repository'

import { AccountSuspendedError } from '../auth/errors'
import { SavedSearchForbiddenError } from './errors'

export class DeleteSavedSearch {
  constructor(private readonly savedSearchRepository: SavedSearchRepository) {}

  async execute(actor: User, searchId: string): Promise<void> {
    if (actor.status !== 'active') {
      throw new AccountSuspendedError(actor.status)
    }

    const search = await this.savedSearchRepository.findById(searchId)
    if (!search) throw new SavedSearchNotFoundError(searchId)
    if (search.userId !== actor.id) {
      throw new SavedSearchForbiddenError()
    }

    await this.savedSearchRepository.delete(searchId)
  }
}
