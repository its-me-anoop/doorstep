/**
 * SearchUsers — ADM-3 admin user lookup by name or email substring.
 */

import type { User, UserCursorPage, UserRepository } from '@/ports/user-repository'
import { requireRole } from '@/services/authz/policies'

import { AccountSuspendedError } from '../auth/errors'

export interface SearchUsersOptions {
  q?: string
  cursor?: string | null
  limit?: number
}

export class SearchUsers {
  constructor(private readonly userRepository: UserRepository) {}

  async execute(
    actor: User,
    options: SearchUsersOptions = {},
  ): Promise<UserCursorPage> {
    if (actor.status !== 'active') {
      throw new AccountSuspendedError(actor.status)
    }
    requireRole(actor, 'admin')

    return this.userRepository.search(options)
  }
}
