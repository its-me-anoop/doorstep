import { describe, expect, it } from 'vitest'

import { mapRowToOutboxEntry } from '@/adapters/drizzle/repositories/outbox-repository'
import type { outbox } from '@/adapters/drizzle/schema'

type OutboxRow = typeof outbox.$inferSelect

// mapRowToOutboxEntry is a pure function (row -> port OutboxEntry), so it
// is unit-testable without a database connection.
// DrizzleOutboxRepository's claim/mark/count methods are exercised
// against a real Postgres instance in
// tests/integration/outbox-repository.test.ts, gated on TEST_DATABASE_URL.
describe('mapRowToOutboxEntry', () => {
  function row(overrides: Partial<OutboxRow> = {}): OutboxRow {
    return {
      id: '0190f4b0-0000-7000-8000-000000000001',
      propertyId: '0190f4b0-0000-7000-8000-000000000010',
      op: 'upsert',
      enqueuedAt: new Date('2026-01-01T00:00:00Z'),
      processedAt: null,
      claimedAt: null,
      ...overrides,
    }
  }

  it('maps an outbox row to the port shape', () => {
    expect(mapRowToOutboxEntry(row())).toEqual({
      id: '0190f4b0-0000-7000-8000-000000000001',
      propertyId: '0190f4b0-0000-7000-8000-000000000010',
      op: 'upsert',
      enqueuedAt: new Date('2026-01-01T00:00:00Z'),
    })
  })

  it('maps a delete op through unchanged', () => {
    expect(mapRowToOutboxEntry(row({ op: 'delete' })).op).toBe('delete')
  })

  it('omits processedAt and claimedAt — implementation detail, not part of the port contract', () => {
    const mapped = mapRowToOutboxEntry(
      row({ processedAt: new Date(), claimedAt: new Date() }),
    ) as unknown as Record<string, unknown>
    expect(mapped.processedAt).toBeUndefined()
    expect(mapped.claimedAt).toBeUndefined()
  })
})
