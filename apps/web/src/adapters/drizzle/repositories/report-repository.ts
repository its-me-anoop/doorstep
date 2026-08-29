/**
 * DrizzleReportRepository — the ReportRepository port
 * (ports/report-repository.ts) implemented against `reports`.
 */

import { and, desc, eq, lt } from 'drizzle-orm'

import {
  ReportNotFoundError,
  type NewReport,
  type Report,
  type ReportCursorPage,
  type ReportRepository,
} from '@/ports/report-repository'

import type { Db } from '../client'
import { reports } from '../schema'

type ReportRow = typeof reports.$inferSelect

const DEFAULT_PAGE_LIMIT = 20

/** Maps a `reports` table row to the port's `Report` shape. Pure and
 * DB-free, so it is unit-tested directly. */
export function mapRowToReport(row: ReportRow): Report {
  return {
    id: row.id,
    propertyId: row.propertyId,
    reporterId: row.reporterId,
    reporterEmail: row.reporterEmail,
    reason: row.reason,
    details: row.details,
    status: row.status,
    resolvedBy: row.resolvedBy,
    resolvedAt: row.resolvedAt,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  }
}

export class DrizzleReportRepository implements ReportRepository {
  constructor(private readonly db: Db) {}

  async create(report: NewReport): Promise<Report> {
    const [row] = await this.db
      .insert(reports)
      .values({
        propertyId: report.propertyId,
        reporterId: report.reporterId,
        reporterEmail: report.reporterEmail,
        reason: report.reason,
        details: report.details,
      })
      .returning()
    if (!row) {
      throw new Error('DrizzleReportRepository.create: insert returned no row')
    }
    return mapRowToReport(row)
  }

  async listOpen(options?: {
    cursor?: string | null
    limit?: number
  }): Promise<ReportCursorPage> {
    const { cursor, limit = DEFAULT_PAGE_LIMIT } = options ?? {}
    const clauses = [eq(reports.status, 'open')]
    if (cursor) clauses.push(lt(reports.id, cursor))

    const rows = await this.db
      .select()
      .from(reports)
      .where(and(...clauses))
      .orderBy(desc(reports.id))
      .limit(limit + 1)

    const page = rows.slice(0, limit)
    const nextCursor = rows.length > limit ? (page.at(-1)?.id ?? null) : null

    return { data: page.map(mapRowToReport), nextCursor }
  }

  async findById(id: string): Promise<Report | null> {
    const [row] = await this.db
      .select()
      .from(reports)
      .where(eq(reports.id, id))
      .limit(1)
    return row ? mapRowToReport(row) : null
  }

  async resolve(
    id: string,
    resolverId: string,
    status: 'resolved' | 'dismissed',
  ): Promise<Report> {
    const resolvedAt = new Date()
    const [row] = await this.db
      .update(reports)
      .set({
        status,
        resolvedBy: resolverId,
        resolvedAt,
      })
      .where(eq(reports.id, id))
      .returning()
    if (!row) throw new ReportNotFoundError(id)
    return mapRowToReport(row)
  }
}
