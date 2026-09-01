/**
 * UnsaveProperty — remove a favourite (PRD §6.3 ACC-2). Idempotent.
 */

import type { SavedPropertyRepository } from '@/ports/saved-property-repository'
import type { User } from '@/ports/user-repository'

import { AccountSuspendedError } from '../auth/errors'

export class UnsaveProperty {
  constructor(
    private readonly savedPropertyRepository: SavedPropertyRepository,
  ) {}

  async execute(actor: User, propertyId: string): Promise<void> {
    if (actor.status !== 'active') {
      throw new AccountSuspendedError(actor.status)
    }

    await this.savedPropertyRepository.unsave(actor.id, propertyId)
  }
}
