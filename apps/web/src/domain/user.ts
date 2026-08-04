/**
 * The `users` entity (PRD §9.2). Auth identity lives in Firebase; this is
 * the app-profile row that mirrors it. Ports' `User` projection type
 * (ports/user-repository.ts) reuses the enums declared here rather than
 * redeclaring them.
 */

import type { UserRole, UserStatus } from './enums'

export interface UserEntity {
  id: string
  firebaseUid: string
  email: string
  displayName: string
  phone: string | null
  role: UserRole
  agencyId: string | null
  status: UserStatus
  lastSeenAt: Date | null
  createdAt: Date
  updatedAt: Date
}

export type { UserRole, UserStatus }
