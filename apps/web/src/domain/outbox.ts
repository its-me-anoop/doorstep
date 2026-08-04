import type { OutboxOp } from './enums'

/**
 * The `outbox` entity (PRD §8.6, §9.2). Every visibility-relevant
 * property mutation writes a row here in the same transaction; a worker
 * drains it into Meilisearch every minute.
 */
export interface OutboxEntity {
  id: string
  propertyId: string
  op: OutboxOp
  enqueuedAt: Date
  processedAt: Date | null
}
