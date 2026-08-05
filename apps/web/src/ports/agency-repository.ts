/**
 * AgencyRepository — the `agencies` table (PRD §9.2, domain/agency.ts).
 * Reuses domain/agency.ts's AgencyEntity as its projection: unlike
 * UserRepository/ListingRepository (which narrow their own port-local
 * shape), agencies has no fields a port consumer shouldn't see, so there
 * is nothing to gain by redeclaring the same nine columns twice.
 */

import type { AgencyEntity } from '@/domain/agency'

export type Agency = AgencyEntity

export interface AgencyRepository {
  findBySlug(slug: string): Promise<Agency | null>
  findById(id: string): Promise<Agency | null>
  /**
   * @throws {AgencySlugConflictError} when the insert would violate the
   * `agencies_slug_idx` unique constraint — most notably two concurrent
   * onboarding requests deriving the same deduped slug from the same (or
   * colliding) agency name. Callers decide how to recover (see
   * services/listers/create-agency.ts); this port only promises the error
   * is typed rather than a generic driver error.
   */
  create(
    agency: Omit<Agency, 'id' | 'createdAt' | 'updatedAt'>,
  ): Promise<Agency>
}

/**
 * Thrown by `AgencyRepository.create` when the insert would violate the
 * unique constraint on `agencies.slug`. Adapters translate their
 * driver-specific "unique violation" error into this so services/ never
 * depends on a Postgres error code (DIP) — see DrizzleAgencyRepository.create
 * and the in-memory FakeAgencyRepository used in tests. Mirrors
 * ports/user-repository.ts's UniqueViolationError, scoped to the one
 * column agencies can actually collide on.
 */
export class AgencySlugConflictError extends Error {
  readonly slug: string

  constructor(slug: string) {
    super(
      `AgencyRepository.create: unique constraint violated on slug "${slug}"`,
    )
    this.name = 'AgencySlugConflictError'
    this.slug = slug
  }
}
