/**
 * In-memory fake for services/listers/*'s TDD suite (PRD §8.5: services
 * are developed against in-memory fakes). FakeAuthGateway and
 * FakeUserRepository are reused unchanged from services/auth's suite —
 * see tests/unit/services/auth/fakes.ts.
 */

import {
  AgencySlugConflictError,
  type Agency,
  type AgencyRepository,
} from '@/ports/agency-repository'

export class FakeAgencyRepository implements AgencyRepository {
  private readonly byId = new Map<string, Agency>()
  private nextId = 1
  private beforeNextCreate: (() => void) | null = null

  async findBySlug(slug: string): Promise<Agency | null> {
    for (const agency of this.byId.values()) {
      if (agency.slug === slug) return agency
    }
    return null
  }

  async findById(id: string): Promise<Agency | null> {
    return this.byId.get(id) ?? null
  }

  async create(
    agency: Omit<Agency, 'id' | 'createdAt' | 'updatedAt'>,
  ): Promise<Agency> {
    // Runs (once) immediately before the uniqueness check below — see
    // runBeforeNextCreate, mirroring FakeUserRepository's same-named hook.
    const hook = this.beforeNextCreate
    this.beforeNextCreate = null
    hook?.()

    if (await this.findBySlug(agency.slug)) {
      throw new AgencySlugConflictError(agency.slug)
    }

    const now = new Date()
    const created: Agency = {
      ...agency,
      id: `agency-${this.nextId++}`,
      createdAt: now,
      updatedAt: now,
    }
    this.byId.set(created.id, created)
    return created
  }

  async update(
    id: string,
    changes: Partial<
      Pick<
        Agency,
        'name' | 'logoPath' | 'phone' | 'email' | 'website' | 'address' | 'verified'
      >
    >,
  ): Promise<Agency> {
    const existing = this.byId.get(id)
    if (!existing) {
      throw new Error(`FakeAgencyRepository.update: no agency with id ${id}`)
    }
    const updated: Agency = {
      ...existing,
      ...changes,
      updatedAt: new Date(),
    }
    this.byId.set(id, updated)
    return updated
  }

  async list(): Promise<{ data: Agency[]; nextCursor: string | null }> {
    return { data: [], nextCursor: null }
  }

  /** Test helper: seed an agency directly, bypassing create(). */
  seed(agency: Agency): void {
    this.byId.set(agency.id, agency)
  }

  /**
   * Test helper: simulates a state change landing between a caller's
   * findBySlug check and its create() call — a concurrent onboarding
   * request winning the same deduped slug (seed the winner, so create()
   * then throws AgencySlugConflictError like a real unique-index hit).
   * See services/listers/fakes.ts's FakeUserRepository counterpart.
   */
  runBeforeNextCreate(fn: () => void): void {
    this.beforeNextCreate = fn
  }
}
