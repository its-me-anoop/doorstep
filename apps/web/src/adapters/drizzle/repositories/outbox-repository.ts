/**
 * DrizzleOutboxRepository — the OutboxRepository port
 * (ports/outbox-repository.ts) implemented against `outbox`, in the same
 * shape as this directory's other repositories: constructor-injected
 * `Db` (DIP), a pure row mapper exported and unit-tested directly, the
 * class itself exercised against a real Postgres instance in
 * tests/integration/.
 *
 * See ports/outbox-repository.ts's header comment for the full
 * SKIP LOCKED + lease concurrency story this class implements.
 */

import { and, asc, count, inArray, isNull, lt, or } from 'drizzle-orm'

import type { OutboxEntry, OutboxRepository } from '@/ports/outbox-repository'

import type { Db } from '../client'
import { outbox } from '../schema'

type OutboxRow = typeof outbox.$inferSelect

/** How long a claimed row stays excluded from another claimBatch call
 * before it's treated as abandoned and becomes claimable again (see
 * ports/outbox-repository.ts's header comment on lease expiry as the
 * recovery path for a crashed run). Five minutes is generous relative to
 * the drain worker's own one-minute cron interval and the PRD §8.6
 * "publish-to-searchable under 1 minute" batch-processing target — a run
 * healthy enough to finish at all finishes in seconds, not minutes, so
 * this only ever matters on genuine failure. */
export const DEFAULT_LEASE_DURATION_MS = 5 * 60 * 1000

/** Maps an `outbox` table row to the OutboxRepository port's `OutboxEntry`
 * shape. Pure and DB-free, so it is unit-tested directly — see this
 * directory's other repositories for the same pattern. Deliberately omits
 * `processedAt`/`claimedAt`: neither is part of the port's contract (a
 * claimed entry is by definition unprocessed, and the lease is this
 * adapter's own implementation detail — see this file's and
 * ports/outbox-repository.ts's header comments). */
export function mapRowToOutboxEntry(row: OutboxRow): OutboxEntry {
  return {
    id: row.id,
    propertyId: row.propertyId,
    op: row.op,
    enqueuedAt: row.enqueuedAt,
  }
}

export class DrizzleOutboxRepository implements OutboxRepository {
  constructor(
    private readonly db: Db,
    private readonly leaseDurationMs: number = DEFAULT_LEASE_DURATION_MS,
  ) {}

  async claimBatch(limit: number): Promise<OutboxEntry[]> {
    if (limit <= 0) return []

    return this.db.transaction(async (tx) => {
      const now = new Date()
      const leaseCutoff = new Date(now.getTime() - this.leaseDurationMs)

      const rows = await tx
        .select()
        .from(outbox)
        .where(
          and(
            isNull(outbox.processedAt),
            or(isNull(outbox.claimedAt), lt(outbox.claimedAt, leaseCutoff)),
          ),
        )
        .orderBy(asc(outbox.enqueuedAt))
        .limit(limit)
        .for('update', { skipLocked: true })

      if (rows.length === 0) return []

      await tx
        .update(outbox)
        .set({ claimedAt: now })
        .where(
          inArray(
            outbox.id,
            rows.map((row) => row.id),
          ),
        )

      return rows.map(mapRowToOutboxEntry)
    })
  }

  async markProcessed(ids: string[]): Promise<void> {
    if (ids.length === 0) return
    await this.db
      .update(outbox)
      .set({ processedAt: new Date() })
      .where(inArray(outbox.id, ids))
  }

  async countPending(): Promise<number> {
    const [row] = await this.db
      .select({ value: count() })
      .from(outbox)
      .where(isNull(outbox.processedAt))
    return row?.value ?? 0
  }
}
