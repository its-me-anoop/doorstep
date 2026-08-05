/**
 * CreateAgency — the use case behind POST /api/v1/onboarding/agency (PRD
 * §6.5 LST-1's "I'm an agent" path). Creates the `agencies` row —
 * unverified until an admin checks it offline (PRD §9.2) — and promotes
 * the actor to `agent` on it. Joining an *existing* agency (the PRD's
 * "requests to join, approved by the agency creator" path) is explicitly
 * out of scope for M1 — see the route's doc comment.
 *
 * Firebase custom claims: see services/listers/become-owner.ts's doc
 * comment — the same PRD §8.4 claim-refresh reasoning applies here.
 */

import { slugify } from '@/domain/slug'
import type { CreateAgencyInput } from '@/lib/validation/agency'
import type { AuthGateway } from '@/ports/auth-gateway'
import {
  AgencySlugConflictError,
  type Agency,
  type AgencyRepository,
} from '@/ports/agency-repository'
import type { User, UserRepository } from '@/ports/user-repository'

import { AccountSuspendedError } from '../auth/errors'
import { requireRole } from '../authz/policies'

export interface CreateAgencyResult {
  user: User
  agency: Agency
}

export class CreateAgency {
  constructor(
    private readonly agencyRepository: AgencyRepository,
    private readonly userRepository: UserRepository,
    private readonly authGateway: AuthGateway,
  ) {}

  async execute(
    actor: User,
    input: CreateAgencyInput,
  ): Promise<CreateAgencyResult> {
    if (actor.status !== 'active') {
      throw new AccountSuspendedError(actor.status)
    }
    // A plain 'user' onboarding for the first time, or an existing
    // private 'owner' switching to an agency, may create one — an agent
    // (already on an agency) and an admin both get rejected here rather
    // than silently no-op'd.
    requireRole(actor, 'user', 'owner')

    const agency = await this.createWithUniqueSlug(actor.id, input)

    const user = await this.userRepository.update(actor.id, {
      role: 'agent',
      agencyId: agency.id,
    })
    await this.authGateway.setRoleClaims(actor.firebaseUid, {
      role: 'agent',
      agencyId: agency.id,
    })

    return { user, agency }
  }

  private async createWithUniqueSlug(
    actorId: string,
    input: CreateAgencyInput,
  ): Promise<Agency> {
    const slug = await this.generateUniqueSlug(input.name)
    try {
      return await this.agencyRepository.create(
        this.toAgencyFields(actorId, input, slug),
      )
    } catch (error) {
      if (!(error instanceof AgencySlugConflictError)) throw error
      // Two concurrent onboarding requests for identically (or
      // similarly) named agencies generated the same deduped slug: the
      // other one won the race and already inserted it — recompute
      // against current repository state and retry exactly once, the
      // same pattern as services/auth/establish-session.ts's ensureUser
      // applies to users.firebase_uid.
      const retrySlug = await this.generateUniqueSlug(input.name)
      return await this.agencyRepository.create(
        this.toAgencyFields(actorId, input, retrySlug),
      )
    }
  }

  private toAgencyFields(
    actorId: string,
    input: CreateAgencyInput,
    slug: string,
  ): Omit<Agency, 'id' | 'createdAt' | 'updatedAt'> {
    return {
      name: input.name,
      slug,
      // Logo upload is out of scope for M1 onboarding (PRD §6.5 LST-6
      // covers agency page management, including the logo, later).
      logoPath: null,
      phone: input.phone,
      email: input.email,
      website: input.website,
      address: input.address,
      verified: false,
      createdBy: actorId,
    }
  }

  private async generateUniqueSlug(name: string): Promise<string> {
    const base = slugify(name)
    let candidate = base
    let suffix = 2
    while (await this.agencyRepository.findBySlug(candidate)) {
      candidate = `${base}-${suffix}`
      suffix += 1
    }
    return candidate
  }
}
