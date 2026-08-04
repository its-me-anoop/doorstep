import { describe, expect, it } from 'vitest'

import { mapRowToUser } from '@/adapters/drizzle/repositories/user-repository'

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
