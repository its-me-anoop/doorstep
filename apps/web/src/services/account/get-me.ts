/**
 * GetMe — return the signed-in user's profile (PRD §6.3 ACC-3).
 */

import type { User, UserRepository } from '@/ports/user-repository'

import { AccountSuspendedError } from '../auth/errors'

export class GetMe {
  constructor(private readonly userRepository: UserRepository) {}

  async execute(actor: User): Promise<User> {
    if (actor.status !== 'active') {
      throw new AccountSuspendedError(actor.status)
    }

    const user = await this.userRepository.findById(actor.id)
    if (!user) {
      throw new Error(`User ${actor.id} not found`)
    }
    return user
  }
}
