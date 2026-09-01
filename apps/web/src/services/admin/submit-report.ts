/**
 * SubmitReport — public listing report (PRD §6.6 ADM-2).
 */

import { submitReportSchema } from '@/lib/validation/report'
import type {
  NewReport,
  Report,
  ReportRepository,
} from '@/ports/report-repository'
import type { User } from '@/ports/user-repository'

import { ReportValidationError } from './errors'

export interface SubmitReportRequest {
  propertyId: string
  reason: string
  details?: string | null
  reporterEmail?: string | null
}

export class SubmitReport {
  constructor(private readonly reportRepository: ReportRepository) {}

  async execute(
    actor: User | null,
    input: SubmitReportRequest,
  ): Promise<Report> {
    const parsed = submitReportSchema.safeParse(input)
    if (!parsed.success) {
      throw new ReportValidationError(
        parsed.error.issues.map((issue) => ({
          path: issue.path.join('.'),
          message: issue.message,
        })),
      )
    }

    const report: NewReport = {
      propertyId: parsed.data.propertyId,
      reporterId: actor?.id ?? null,
      reporterEmail: actor?.email ?? input.reporterEmail ?? null,
      reason: parsed.data.reason,
      details: parsed.data.details,
    }

    return this.reportRepository.create(report)
  }
}
