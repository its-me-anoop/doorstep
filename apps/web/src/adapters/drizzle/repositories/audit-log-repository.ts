/**
 * DrizzleAuditLogRepository — the AuditLogRepository port
 * (ports/audit-log-repository.ts) implemented against `audit_log`.
 */

import { and, desc, eq, lt, type SQL } from 'drizzle-orm'

import type {
  AuditLogEntry,
  AuditLogFilter,
  AuditLogPage,
  AuditLogRepository,
  NewAuditLogEntry,
} from '@/ports/audit-log-repository'

import type { Db } from '../client'
import { auditLog } from '../schema'

type AuditLogRow = typeof auditLog.$inferSelect

const DEFAULT_PAGE_LIMIT = 20

/** Maps an `audit_log` table row to the port's `AuditLogEntry` shape.
 * Pure and DB-free, so it is unit-tested directly. */
export function mapRowToAuditLogEntry(row: AuditLogRow): AuditLogEntry {
  return {
    id: row.id,
    actorId: row.actorId,
    action: row.action,
    entityType: row.entityType,
    entityId: row.entityId,
    reason: row.reason,
    metadata: row.metadata as Record<string, unknown>,
    createdAt: row.createdAt,
  }
}

export class DrizzleAuditLogRepository implements AuditLogRepository {
  constructor(private readonly db: Db) {}

  async append(entry: NewAuditLogEntry): Promise<AuditLogEntry> {
    const [row] = await this.db
      .insert(auditLog)
      .values({
        actorId: entry.actorId,
        action: entry.action,
        entityType: entry.entityType,
        entityId: entry.entityId,
        reason: entry.reason ?? null,
        metadata: entry.metadata ?? {},
      })
      .returning()
    if (!row) {
      throw new Error('DrizzleAuditLogRepository.append: insert returned no row')
    }
    return mapRowToAuditLogEntry(row)
  }

  async list(filter: AuditLogFilter = {}): Promise<AuditLogPage> {
    const {
      actorId,
      entityType,
      entityId,
      action,
      cursor,
      limit = DEFAULT_PAGE_LIMIT,
    } = filter

    const clauses: SQL[] = []
    if (actorId !== undefined) clauses.push(eq(auditLog.actorId, actorId))
    if (entityType !== undefined) {
      clauses.push(eq(auditLog.entityType, entityType))
    }
    if (entityId !== undefined) clauses.push(eq(auditLog.entityId, entityId))
    if (action !== undefined) clauses.push(eq(auditLog.action, action))
    if (cursor) clauses.push(lt(auditLog.id, cursor))

    const where = clauses.length > 0 ? and(...clauses) : undefined

    const rows = await this.db
      .select()
      .from(auditLog)
      .where(where)
      .orderBy(desc(auditLog.id))
      .limit(limit + 1)

    const page = rows.slice(0, limit)
    const nextCursor = rows.length > limit ? (page.at(-1)?.id ?? null) : null

    return { data: page.map(mapRowToAuditLogEntry), nextCursor }
  }
}
