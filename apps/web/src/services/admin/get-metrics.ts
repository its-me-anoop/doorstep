/**
 * GetMetrics — ADM-4 admin dashboard aggregates from listing reader,
 * user repository, and event repository.
 */

import type { EventRepository } from '@/ports/event-repository'
import type { ListingReader } from '@/ports/listing-repository'
import type { User, UserRepository } from '@/ports/user-repository'
import { requireRole } from '@/services/authz/policies'

import { AccountSuspendedError } from '../auth/errors'

const THIRTY_DAYS_MS = 30 * 24 * 60 * 60 * 1000

export interface AdminMetrics {
  liveListings: { sale: number; rent: number }
  pendingReviewCount: number
  oldestPendingReviewAt: Date | null
  newUsersLast30Days: number
  searchesPerDay: Array<{ day: string; count: number }>
  topSearchedAreas: Array<{ value: string; count: number }>
}

export class GetMetrics {
  constructor(
    private readonly listingReader: ListingReader,
    private readonly userRepository: UserRepository,
    private readonly eventRepository: EventRepository,
  ) {}

  async execute(actor: User): Promise<AdminMetrics> {
    if (actor.status !== 'active') {
      throw new AccountSuspendedError(actor.status)
    }
    requireRole(actor, 'admin')

    const since = new Date(Date.now() - THIRTY_DAYS_MS)

    const [
      liveListings,
      pendingReviewCount,
      oldestPendingReviewAt,
      newUsersLast30Days,
      searchesPerDay,
      topSearchedAreas,
    ] = await Promise.all([
      this.listingReader.countLiveByChannel(),
      this.listingReader.countByStatus('pending_review'),
      this.listingReader.oldestPendingReviewAt(),
      this.userRepository.countCreatedSince(since),
      this.eventRepository.countByDay('search', since),
      this.eventRepository.topPropertyValues('search', 'area', since, 10),
    ])

    return {
      liveListings,
      pendingReviewCount,
      oldestPendingReviewAt,
      newUsersLast30Days,
      searchesPerDay,
      topSearchedAreas,
    }
  }
}
