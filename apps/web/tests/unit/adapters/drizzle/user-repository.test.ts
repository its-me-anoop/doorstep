import postgres from 'postgres'
import { describe, expect, it } from 'vitest'

import {
  mapRowToUser,
  mapUniqueViolation,
} from '@/adapters/drizzle/repositories/user-repository'
import { UniqueViolationError } from '@/ports/user-repository'

// mapRowToUser is a pure function (row -> domain User), so it is
// unit-testable without a database connection. The DrizzleUserRepository
// class that wraps it with actual queries is exercised against a real
// Postgres instance in tests/integration/db.schema.test.ts, gated on
// TEST_DATABASE_URL (no live database on this machine).
describe('mapRowToUser', () => {
  it('maps a users row to the UserRepository port shape', () => {
    const row = {
      id: '0190f4b0-0000-7000-8000-000000000001',
      firebaseUid: 'firebase-abc123',
      email: 'agent@example.co.uk',
      displayName: 'Jamie Agent',
      phone: '07700 900123',
      role: 'agent' as const,
      agencyId: '0190f4b0-0000-7000-8000-000000000002',
      status: 'active' as const,
      lastSeenAt: new Date('2026-08-01T09:00:00Z'),
      createdAt: new Date('2026-01-01T00:00:00Z'),
      updatedAt: new Date('2026-08-01T09:00:00Z'),
    }

    expect(mapRowToUser(row)).toEqual({
      id: row.id,
      firebaseUid: row.firebaseUid,
      email: row.email,
      displayName: row.displayName,
      role: row.role,
      agencyId: row.agencyId,
      status: row.status,
    })
  })

  it('maps a null agencyId through unchanged', () => {
    const row = {
      id: '0190f4b0-0000-7000-8000-000000000003',
      firebaseUid: 'firebase-def456',
      email: 'user@example.co.uk',
      displayName: 'Casey User',
      phone: null,
      role: 'user' as const,
      agencyId: null,
      status: 'active' as const,
      lastSeenAt: null,
      createdAt: new Date('2026-01-01T00:00:00Z'),
      updatedAt: new Date('2026-01-01T00:00:00Z'),
    }

    expect(mapRowToUser(row).agencyId).toBeNull()
  })
})

// mapUniqueViolation is the same kind of pure, DB-free translation as
// mapRowToUser — the failure mode it exists for (two concurrent
// first-sign-ins hitting users_firebase_uid_idx) is exercised
// end-to-end against a real Postgres instance in
// tests/integration/db.schema.test.ts (gated on TEST_DATABASE_URL).
describe('mapUniqueViolation', () => {
  // postgres's own .d.ts declares PostgresError's constructor as
  // `(message?, options?)`, but the runtime constructor actually takes a
  // field bag and Object.assigns it onto the instance — build one the
  // same way the driver does, then assign the field bag as the type
  // declares it (via property assignment, so tsc is happy either way).
  function uniqueViolation(constraintName: string): postgres.PostgresError {
    const error = new postgres.PostgresError(
      `duplicate key value violates unique constraint "${constraintName}"`,
    )
    error.code = '23505'
    error.constraint_name = constraintName
    return error
  }

  it('maps a users_firebase_uid_idx violation to a firebaseUid UniqueViolationError', () => {
    const result = mapUniqueViolation(uniqueViolation('users_firebase_uid_idx'))

    expect(result).toBeInstanceOf(UniqueViolationError)
    expect(result?.field).toBe('firebaseUid')
  })

  it('maps a users_email_idx violation to an email UniqueViolationError', () => {
    const result = mapUniqueViolation(uniqueViolation('users_email_idx'))

    expect(result).toBeInstanceOf(UniqueViolationError)
    expect(result?.field).toBe('email')
  })

  it('returns null for a Postgres error that is not a unique violation', () => {
    const notFoundError = new postgres.PostgresError(
      'relation "users" does not exist',
    )
    notFoundError.code = '42P01'

    expect(mapUniqueViolation(notFoundError)).toBeNull()
  })

  it('returns null for a non-Postgres error', () => {
    expect(mapUniqueViolation(new Error('connection reset'))).toBeNull()
  })
})
