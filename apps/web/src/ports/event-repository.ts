/**
 * EventRepository — first-party analytics (`events` table, PRD §9.2).
 * Powers ADM-4 dashboard aggregates and phone-reveal / search tracking.
 */

import type { EventEntity } from '@/domain/event'

export type AnalyticsEvent = EventEntity

export interface NewAnalyticsEvent {
  name: string
  anonId: string
  userId?: string | null
  properties?: Record<string, unknown>
}

export interface EventRepository {
  record(event: NewAnalyticsEvent): Promise<AnalyticsEvent>
  /**
   * Count events named `name` created on/after `since`, optionally
   * filtered by a properties key (e.g. top searched areas).
   */
  countSince(name: string, since: Date): Promise<number>
  /**
   * Top N distinct values of `properties[propertyKey]` for events named
   * `name` since `since`, ordered by count descending.
   */
  topPropertyValues(
    name: string,
    propertyKey: string,
    since: Date,
    limit: number,
  ): Promise<Array<{ value: string; count: number }>>
  countByDay(
    name: string,
    since: Date,
  ): Promise<Array<{ day: string; count: number }>>
}
