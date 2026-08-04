/**
 * In-memory fakes for services/auth/*'s TDD suite (PRD §8.5: domain and
 * services are developed against in-memory fakes, no live Firebase
 * project or database available locally).
 */

import type {
  AuthGateway,
  DecodedIdentity,
  RoleClaims,
} from '@/ports/auth-gateway'
import type { Clock } from '@/ports/clock'
import type { User, UserRepository } from '@/ports/user-repository'

export class FakeClock implements Clock {
  constructor(private current: Date) {}

  now(): Date {
    return this.current
  }

  advanceBy(ms: number): void {
    this.current = new Date(this.current.getTime() + ms)
  }
}

/** Seeded with `identities`, keyed by the credential string a test hands
 * to verifyIdToken/verifySessionCookie. Both methods share one map since
 * services/auth never needs to distinguish which credential kind it got —
 * see DecodedIdentity's doc comment. */
export class FakeAuthGateway implements AuthGateway {
  readonly revokedUids: string[] = []
  readonly roleClaimsSet: Array<{ uid: string; claims: RoleClaims }> = []
  private readonly identities = new Map<string, DecodedIdentity>()

  seedCredential(credential: string, identity: DecodedIdentity): void {
    this.identities.set(credential, identity)
  }

  async verifyIdToken(idToken: string): Promise<DecodedIdentity> {
    return this.resolve(idToken)
  }

  // Only `idToken` matters to the fake — omitting `expiresInMs` is valid
  // TS (fewer params is a safe subtype of AuthGateway's method) and
  // avoids an unused-parameter lint warning for a value no test needs.
  async createSessionCookie(idToken: string): Promise<string> {
    // Verify first so an invalid ID token can't be exchanged for a cookie.
    this.resolve(idToken)
    return `session-cookie-for:${idToken}`
  }

  async verifySessionCookie(cookie: string): Promise<DecodedIdentity> {
    return this.resolve(cookie)
  }

  async revokeSessions(uid: string): Promise<void> {
    this.revokedUids.push(uid)
  }

  async setRoleClaims(uid: string, claims: RoleClaims): Promise<void> {
    this.roleClaimsSet.push({ uid, claims })
  }

  private resolve(credential: string): DecodedIdentity {
    const identity = this.identities.get(credential)
    if (!identity) {
      throw new Error(`FakeAuthGateway: no identity seeded for "${credential}"`)
    }
    return identity
  }
}

export class FakeUserRepository implements UserRepository {
  private readonly byId = new Map<string, User>()
  private nextId = 1

  async findById(id: string): Promise<User | null> {
    return this.byId.get(id) ?? null
  }

  async findByFirebaseUid(firebaseUid: string): Promise<User | null> {
    for (const user of this.byId.values()) {
      if (user.firebaseUid === firebaseUid) return user
    }
    return null
  }

  async create(user: Omit<User, 'id'>): Promise<User> {
    const created: User = { ...user, id: `user-${this.nextId++}` }
    this.byId.set(created.id, created)
    return created
  }

  async update(id: string, changes: Partial<Omit<User, 'id'>>): Promise<User> {
    const existing = this.byId.get(id)
    if (!existing) {
      throw new Error(`FakeUserRepository.update: no user with id ${id}`)
    }
    const updated = { ...existing, ...changes }
    this.byId.set(id, updated)
    return updated
  }

  /** Test helper: seed a user directly, bypassing create(). */
  seed(user: User): void {
    this.byId.set(user.id, user)
  }
}
