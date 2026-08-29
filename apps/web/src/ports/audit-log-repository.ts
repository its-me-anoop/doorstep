/**
 * AuditLogRepository — insert-only admin accountability log (PRD §6.6
 * ADM-5, domain/audit-log.ts). No update/delete methods on purpose —
 * the UI is filterable and immutable.
 */

import type { AuditLogEntity } from '@/domain/audit-log'

export type AuditLogEntry = AuditLogEntity

export interface NewAuditLogEntry {
  actorId: string
  action: string
  entityType: string
  entityId: string
  reason?: string | null
  metadata?: Record<string, unknown>
}

export interface AuditLogFilter {
  actorId?: string
  entityType?: string
  entityId?: string
  action?: string
  cursor?: string | null
  limit?: number
}

export interface AuditLogPage {
  data: AuditLogEntry[]
  nextCursor: string | null
}

export interface AuditLogRepository {
  append(entry: NewAuditLogEntry): Promise<AuditLogEntry>
  list(filter?: AuditLogFilter): Promise<AuditLogPage>
}
