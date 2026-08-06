/**
 * OutboxRepository — the transactional outbox `outbox` table (PRD §8.6,
 * §9.2, adapters/drizzle/schema.ts) as read/written by the (future) drain
 * worker (services/search-sync/drain-outbox.ts). Every visibility-relevant
 * listing mutation writes a row here in the same transaction as the
 * `properties` update (ports/listing-repository.ts's ListingSideEffects/
 * ListingTransitionOptions); this port is the other half — draining rows
 * back out again.
 *
 * Concurrency story (PRD §8.6: "a Vercel Cron worker drains the outbox
 * every minute"): Vercel Cron does not guarantee a new invocation waits
 * for the previous one to finish, so a slow drain (a large batch, a slow
 * Meilisearch response) can still be running when the next minute's
 * invocation starts. `claimBatch` must ensure the two invocations never
 * process the same row twice. It does this with two mechanisms working
 * together, both inside one short DB transaction:
 *
 *  1. `SELECT ... FOR UPDATE SKIP LOCKED` — if two `claimBatch` calls
 *     genuinely overlap in time, Postgres itself guarantees they can never
 *     select the same row: the second transaction skips any row the first
 *     has locked, rather than blocking on it.
 *  2. A `claimed_at` lease timestamp, stamped (in the same transaction) on
 *     every row the SELECT returns, and excluded from the next
 *     `claimBatch` call's own SELECT while the lease is still fresh (see
 *     the implementation's `leaseDurationMs`). This covers the case the
 *     first mechanism can't: two calls that do NOT overlap in time (the
 *     first has already committed and released its row locks) but where
 *     the first run is still busy processing what it claimed when the
 *     second starts a minute later.
 *
 * A row's lease expiring before `markProcessed` is ever called for it
 * (the claiming run crashed, or a Vercel function invocation was killed
 * for exceeding its execution limit) is the intended, safe recovery path,
 * not a bug: the row becomes claimable again and gets retried. This is
 * only safe because every op DrainOutbox applies (Meilisearch upsert or
 * delete, keyed on the listing's id) is idempotent — reprocessing a row
 * a second time has the same end state as processing it once.
 *
 * `markProcessed` is deliberately a separate method from `claimBatch`,
 * not folded into it — see services/search-sync/drain-outbox.ts's doc
 * comment for why the caller controls exactly when a batch is marked
 * done (only after the corresponding Meilisearch writes succeed).
 */

import type { OutboxOp } from '@/domain/enums'

export interface OutboxEntry {
  id: string
  propertyId: string
  op: OutboxOp
  enqueuedAt: Date
}

export interface OutboxRepository {
  /**
   * Claims up to `limit` unprocessed, unleased rows, oldest-enqueued
   * first (FIFO), and returns them. See this file's header comment for
   * the full concurrency story. Returns fewer than `limit` rows — down to
   * an empty array — whenever that's all there is to claim; this is the
   * normal, expected case once the outbox is mostly drained, not a
   * failure.
   */
  claimBatch(limit: number): Promise<OutboxEntry[]>
  /** Marks every given row's id as done — excluded from every future
   * claimBatch call regardless of its lease. A no-op for an unknown id
   * (mirrors ImageStorage.delete's "already gone is not an error" — PRD
   * §10's idempotent-DELETE convention). */
  markProcessed(ids: string[]): Promise<void>
  /** Count of rows with no `processedAt` yet, leased or not — the
   * "how far behind is the drain worker" number DrainOutbox's result
   * reports as `pendingRemaining`. */
  countPending(): Promise<number>
}
