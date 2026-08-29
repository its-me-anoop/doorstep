/**
 * RecordEvent — thin analytics wrapper for phone-reveal, search, etc.
 * (PRD §9.2 events table, ADM-4 aggregates).
 */

import type { EventRepository, NewAnalyticsEvent } from '@/ports/event-repository'

export class RecordEvent {
  constructor(private readonly eventRepository: EventRepository) {}

  async execute(event: NewAnalyticsEvent) {
    return this.eventRepository.record(event)
  }
}
