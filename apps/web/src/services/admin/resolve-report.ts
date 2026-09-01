/**
 * ResolveReport — ADM-2 close a user report as resolved or dismissed.
 */

import {
  ReportNotFoundError,
  type Report,
  type ReportRepository,
} from '@/ports/report-repository'
import type { AuditLogRepository } from '@/ports/audit-log-repository'
import type { User } from '@/ports/user-repository'
import { requireRole } from '@/services/authz/policies'

import { AccountSuspendedError } from '../auth/errors'

export type ReportResolution = 'resolved' | 'dismissed'

export class ResolveReport {
  constructor(
    private readonly reportRepository: ReportRepository,
    private readonly auditLogRepository: AuditLogRepository,
  ) {}

  async execute(
    actor: User,
    reportId: string,
    status: ReportResolution,
    reason?: string | null,
  ): Promise<Report> {
    if (actor.status !== 'active') {
      throw new AccountSuspendedError(actor.status)
    }
    requireRole(actor, 'admin')

    const existing = await this.reportRepository.findById(reportId)
    if (!existing) throw new ReportNotFoundError(reportId)

    const updated = await this.reportRepository.resolve(
      reportId,
      actor.id,
      status,
    )

    await this.auditLogRepository.append({
      actorId: actor.id,
      action: `report.${status}`,
      entityType: 'report',
      entityId: reportId,
      reason: reason ?? null,
    })

    return updated
  }
}
