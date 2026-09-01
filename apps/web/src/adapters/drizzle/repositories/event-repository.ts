/**
 * DrizzleEventRepository — the EventRepository port
 * (ports/event-repository.ts) implemented against `events`.
 */

import { and, count, eq, gte, sql } from 'drizzle-orm'

import type {
  AnalyticsEvent,
  EventRepository,
  NewAnalyticsEvent,
} from '@/ports/event-repository'

import type { Db } from '../client'
import { events } from '../schema'

type EventRow = typeof events.$inferSelect

/** Maps an `events` table row to the port's `AnalyticsEvent` shape. Pure
 * and DB-free, so it is unit-tested directly. */
export function mapRowToAnalyticsEvent(row: EventRow): AnalyticsEvent {
  return {
    id: row.id,
    name: row.name,
    anonId: row.anonId,
    userId: row.userId,
    properties: row.properties as Record<string, unknown>,
    createdAt: row.createdAt,
  }
}

export class DrizzleEventRepository implements EventRepository {
  constructor(private readonly db: Db) {}

  async record(event: NewAnalyticsEvent): Promise<AnalyticsEvent> {
    const [row] = await this.db
      .insert(events)
      .values({
        name: event.name,
        anonId: event.anonId,
        userId: event.userId ?? null,
        properties: event.properties ?? {},
      })
      .returning()
    if (!row) {
      throw new Error('DrizzleEventRepository.record: insert returned no row')
    }
    return mapRowToAnalyticsEvent(row)
  }

  async countSince(name: string, since: Date): Promise<number> {
    const [row] = await this.db
      .select({ value: count() })
      .from(events)
      .where(and(eq(events.name, name), gte(events.createdAt, since)))
    return row?.value ?? 0
  }

  async topPropertyValues(
    name: string,
    propertyKey: string,
    since: Date,
    limit: number,
  ): Promise<Array<{ value: string; count: number }>> {
    const result = await this.db.execute<{
      value: string
      count: number
    }>(sql`
      SELECT ${events.properties}->>${propertyKey} AS value,
             count(*)::int AS count
      FROM ${events}
      WHERE ${events.name} = ${name}
        AND ${events.createdAt} >= ${since}
        AND ${events.properties}->>${propertyKey} IS NOT NULL
      GROUP BY value
      ORDER BY count DESC
      LIMIT ${limit}
    `)

    return result.map((row) => ({
      value: row.value,
      count: Number(row.count),
    }))
  }

  async countByDay(
    name: string,
    since: Date,
  ): Promise<Array<{ day: string; count: number }>> {
    const result = await this.db.execute<{
      day: string
      count: number
    }>(sql`
      SELECT to_char(date_trunc('day', ${events.createdAt}), 'YYYY-MM-DD') AS day,
             count(*)::int AS count
      FROM ${events}
      WHERE ${events.name} = ${name}
        AND ${events.createdAt} >= ${since}
      GROUP BY day
      ORDER BY day
    `)

    return result.map((row) => ({
      day: row.day,
      count: Number(row.count),
    }))
  }
}
