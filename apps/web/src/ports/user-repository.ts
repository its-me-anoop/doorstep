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
  create(user: Omit<User, 'id'>): Promise<User>
  update(id: string, changes: Partial<Omit<User, 'id'>>): Promise<User>
}
