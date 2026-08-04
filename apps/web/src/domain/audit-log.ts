/** The `audit_log` entity — insert-only (PRD §9.2). */
export interface AuditLogEntity {
  id: string
  actorId: string
  action: string
  entityType: string
  entityId: string
  reason: string | null
  metadata: Record<string, unknown>
  createdAt: Date
}
