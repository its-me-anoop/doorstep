/**
 * ReportRepository — user-submitted listing reports (PRD §6.6 ADM-2).
 * The `reports` table lands in migration 0004 alongside this port.
 */

export type ReportStatus = 'open' | 'resolved' | 'dismissed'

export interface Report {
  id: string
  propertyId: string
  reporterId: string | null
  reporterEmail: string | null
  reason: string
  details: string | null
  status: ReportStatus
  resolvedBy: string | null
  resolvedAt: Date | null
  createdAt: Date
  updatedAt: Date
}

export interface NewReport {
  propertyId: string
  reporterId: string | null
  reporterEmail: string | null
  reason: string
  details: string | null
}

export interface ReportCursorPage {
  data: Report[]
  nextCursor: string | null
}

export interface ReportRepository {
  create(report: NewReport): Promise<Report>
  listOpen(options?: {
    cursor?: string | null
    limit?: number
  }): Promise<ReportCursorPage>
  findById(id: string): Promise<Report | null>
  resolve(
    id: string,
    resolverId: string,
    status: 'resolved' | 'dismissed',
  ): Promise<Report>
}

export class ReportNotFoundError extends Error {
  readonly reportId: string

  constructor(reportId: string) {
    super(`Report not found: ${reportId}`)
    this.name = 'ReportNotFoundError'
    this.reportId = reportId
  }
}
