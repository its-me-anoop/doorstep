/**
 * DrizzleUserRepository — the worked example of a port satisfied by a
 * Drizzle-backed adapter (PRD §8.5). Only `users` is implemented this
 * commit; the remaining repositories (Listing, PropertyImage, Enquiry,
 * ...) follow the same shape in a later milestone.
 *
 * The class takes its `Db` via constructor injection (DIP) rather than
 * reaching for a module-level singleton, so it can be unit tested with an
 * in-memory fake `Db` later without touching a real connection.
 */

import { eq } from 'drizzle-orm'

import type { User, UserRepository } from '@/ports/user-repository'

import type { Db } from '../client'
import { users } from '../schema'

type UserRow = typeof users.$inferSelect

/** Maps a `users` table row to the UserRepository port's `User` shape.
 * Pure and DB-free, so it is unit-tested directly. */
export function mapRowToUser(row: UserRow): User {
  return {
    id: row.id,
    firebaseUid: row.firebaseUid,
    email: row.email,
    displayName: row.displayName,
    role: row.role,
    agencyId: row.agencyId,
    status: row.status,
  }
}

export class DrizzleUserRepository implements UserRepository {
  constructor(private readonly db: Db) {}

  async findById(id: string): Promise<User | null> {
    const [row] = await this.db
      .select()
      .from(users)
      .where(eq(users.id, id))
      .limit(1)
    return row ? mapRowToUser(row) : null
  }

  async findByFirebaseUid(firebaseUid: string): Promise<User | null> {
    const [row] = await this.db
      .select()
      .from(users)
      .where(eq(users.firebaseUid, firebaseUid))
      .limit(1)
    return row ? mapRowToUser(row) : null
  }

  async create(user: Omit<User, 'id'>): Promise<User> {
    const [row] = await this.db
      .insert(users)
      .values({
        firebaseUid: user.firebaseUid,
        email: user.email,
        displayName: user.displayName,
        role: user.role,
        agencyId: user.agencyId,
        status: user.status,
      })
      .returning()
    if (!row) {
      throw new Error('DrizzleUserRepository.create: insert returned no row')
    }
    return mapRowToUser(row)
  }

  async update(id: string, changes: Partial<Omit<User, 'id'>>): Promise<User> {
    const [row] = await this.db
      .update(users)
      .set(changes)
      .where(eq(users.id, id))
      .returning()
    if (!row) {
      throw new Error(`DrizzleUserRepository.update: no user with id ${id}`)
    }
    return mapRowToUser(row)
  }
}
