/**
 * UpdateProfile — PATCH display name and phone (PRD §6.3 ACC-3).
 */

import { updateProfileSchema } from '@/lib/validation/account'
import type { User, UserRepository } from '@/ports/user-repository'

import { AccountSuspendedError } from '../auth/errors'
import { ProfileValidationError } from './errors'

export interface UpdateProfileInput {
  displayName: string
  phone?: string | null
}

export class UpdateProfile {
  constructor(private readonly userRepository: UserRepository) {}

  async execute(actor: User, input: UpdateProfileInput): Promise<User> {
    if (actor.status !== 'active') {
      throw new AccountSuspendedError(actor.status)
    }

    const parsed = updateProfileSchema.safeParse(input)
    if (!parsed.success) {
      throw new ProfileValidationError(
        parsed.error.issues.map((issue) => ({
          path: issue.path.join('.'),
          message: issue.message,
        })),
      )
    }

    return this.userRepository.update(actor.id, {
      displayName: parsed.data.displayName,
      phone: parsed.data.phone,
    })
  }
}
