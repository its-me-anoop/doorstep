/**
 * In-memory fakes for services/admin/* unit tests.
 */

import type { AuditLogEntity } from '@/domain/audit-log'
import type {
  AuditLogFilter,
  AuditLogPage,
  AuditLogRepository,
  NewAuditLogEntry,
} from '@/ports/audit-log-repository'
import type { Agency, AgencyRepository } from '@/ports/agency-repository'
import type { EventRepository, NewAnalyticsEvent } from '@/ports/event-repository'
import type { AnalyticsEvent } from '@/ports/event-repository'
import type {
  NewReport,
  Report,
  ReportRepository,
} from '@/ports/report-repository'

export class FakeAuditLogRepository implements AuditLogRepository {
  readonly entries: AuditLogEntry[] = []
  private nextId = 1

  async append(entry: NewAuditLogEntry): Promise<AuditLogEntity> {
    const created: AuditLogEntity = {
      id: `audit-${this.nextId++}`,
      actorId: entry.actorId,
      action: entry.action,
      entityType: entry.entityType,
      entityId: entry.entityId,
      reason: entry.reason ?? null,
      metadata: entry.metadata ?? {},
      createdAt: new Date(),
    }
    this.entries.push(created)
    return created
  }

  async list(filter: AuditLogFilter = {}): Promise<AuditLogPage> {
    let data = [...this.entries]
    if (filter.actorId) {
      data = data.filter((entry) => entry.actorId === filter.actorId)
    }
    if (filter.entityType) {
      data = data.filter((entry) => entry.entityType === filter.entityType)
    }
    if (filter.entityId) {
      data = data.filter((entry) => entry.entityId === filter.entityId)
    }
    if (filter.action) {
      data = data.filter((entry) => entry.action === filter.action)
    }
    return { data, nextCursor: null }
  }
}

type AuditLogEntry = AuditLogEntity

export class FakeAgencyRepository implements AgencyRepository {
  private readonly byId = new Map<string, Agency>()

  async findBySlug(): Promise<Agency | null> {
    return null
  }

  async findById(id: string): Promise<Agency | null> {
    return this.byId.get(id) ?? null
  }

  async create(): Promise<Agency> {
    throw new Error('not implemented')
  }

  async update(
    id: string,
    changes: Partial<Pick<Agency, 'verified'>>,
  ): Promise<Agency> {
    const existing = this.byId.get(id)
    if (!existing) throw new Error(`agency ${id} not found`)
    const updated = { ...existing, ...changes, updatedAt: new Date() }
    this.byId.set(id, updated)
    return updated
  }

  async list() {
    return { data: [...this.byId.values()], nextCursor: null }
  }

  seed(agency: Agency): void {
    this.byId.set(agency.id, agency)
  }
}

export class FakeReportRepository implements ReportRepository {
  private readonly byId = new Map<string, Report>()
  private nextId = 1

  async create(report: NewReport): Promise<Report> {
    const now = new Date()
    const created: Report = {
      id: `report-${this.nextId++}`,
      ...report,
      status: 'open',
      resolvedBy: null,
      resolvedAt: null,
      createdAt: now,
      updatedAt: now,
    }
    this.byId.set(created.id, created)
    return created
  }

  async listOpen(options: { cursor?: string | null; limit?: number } = {}) {
    void options
    return {
      data: [...this.byId.values()].filter((report) => report.status === 'open'),
      nextCursor: null,
    }
  }

  async findById(id: string): Promise<Report | null> {
    return this.byId.get(id) ?? null
  }

  async resolve(
    id: string,
    resolverId: string,
    status: 'resolved' | 'dismissed',
  ): Promise<Report> {
    const existing = this.byId.get(id)
    if (!existing) throw new Error(`report ${id} not found`)
    const updated: Report = {
      ...existing,
      status,
      resolvedBy: resolverId,
      resolvedAt: new Date(),
      updatedAt: new Date(),
    }
    this.byId.set(id, updated)
    return updated
  }
}

export class FakeEventRepository implements EventRepository {
  private readonly events: AnalyticsEvent[] = []
  private nextId = 1

  async record(event: NewAnalyticsEvent): Promise<AnalyticsEvent> {
    const created: AnalyticsEvent = {
      id: `event-${this.nextId++}`,
      name: event.name,
      anonId: event.anonId,
      userId: event.userId ?? null,
      properties: event.properties ?? {},
      createdAt: new Date(),
    }
    this.events.push(created)
    return created
  }

  async countSince(name: string, since: Date): Promise<number> {
    return this.events.filter(
      (event) => event.name === name && event.createdAt >= since,
    ).length
  }

  async topPropertyValues(
    name: string,
    propertyKey: string,
    since: Date,
    limit: number,
  ): Promise<Array<{ value: string; count: number }>> {
    const counts = new Map<string, number>()
    for (const event of this.events) {
      if (event.name !== name || event.createdAt < since) continue
      const value = event.properties[propertyKey]
      if (typeof value !== 'string') continue
      counts.set(value, (counts.get(value) ?? 0) + 1)
    }
    return [...counts.entries()]
      .map(([value, count]) => ({ value, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, limit)
  }

  async countByDay(
    name: string,
    since: Date,
  ): Promise<Array<{ day: string; count: number }>> {
    const counts = new Map<string, number>()
    for (const event of this.events) {
      if (event.name !== name || event.createdAt < since) continue
      const day = event.createdAt.toISOString().slice(0, 10)
      counts.set(day, (counts.get(day) ?? 0) + 1)
    }
    return [...counts.entries()].map(([day, count]) => ({ day, count }))
  }
}
