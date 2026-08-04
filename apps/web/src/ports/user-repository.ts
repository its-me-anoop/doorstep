/**
 * UserRepository — the app-profile side of a user (PRD §9.2 `users`
 * table). Auth identity itself lives in Firebase and is reached through
 * adapters/firebase, not this port.
 */

import type { UserRole, UserStatus } from '@/domain/enums'

export type { UserRole, UserStatus }

export interface User {
  id: string
  firebaseUid: string
  email: string
  displayName: string
  role: UserRole
  agencyId: string | null
  status: UserStatus
}

export interface UserRepository {
  findById(id: string): Promise<User | null>
  findByFirebaseUid(firebaseUid: string): Promise<User | null>
  /**
   * @throws {UniqueViolationError} when the row would collide with an
   * existing one on `firebaseUid` or `email` — most notably two
   * concurrent first sign-ins for the same Firebase uid. Callers decide
   * how to recover (see services/auth/establish-session.ts); this port
   * only promises the error is typed rather than a generic driver error.
   */
  create(user: Omit<User, 'id'>): Promise<User>
  update(id: string, changes: Partial<Omit<User, 'id'>>): Promise<User>
}

/**
 * Thrown by `UserRepository.create` when the insert would violate a
 * unique constraint on `users` (`firebase_uid` or `email`). Adapters
 * translate their driver-specific "unique violation" error into this so
 * services/ never depends on a Postgres error code (DIP) — see
 * DrizzleUserRepository.create and the in-memory FakeUserRepository used
 * in tests.
 */
export class UniqueViolationError extends Error {
  readonly field: 'firebaseUid' | 'email'

  constructor(field: 'firebaseUid' | 'email') {
    super(`UserRepository.create: unique constraint violated on "${field}"`)
    this.name = 'UniqueViolationError'
    this.field = field
  }
}
