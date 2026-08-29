/**
 * ListOpenReports — ADM-2 moderation feed of open user reports.
 */

import type { ReportCursorPage, ReportRepository } from '@/ports/report-repository'
import type { User } from '@/ports/user-repository'
import { requireRole } from '@/services/authz/policies'

import { AccountSuspendedError } from '../auth/errors'

export class ListOpenReports {
  constructor(private readonly reportRepository: ReportRepository) {}

  async execute(
    actor: User,
    options: { cursor?: string | null; limit?: number } = {},
  ): Promise<ReportCursorPage> {
    if (actor.status !== 'active') {
      throw new AccountSuspendedError(actor.status)
    }
    requireRole(actor, 'admin')

    return this.reportRepository.listOpen(options)
  }
}
