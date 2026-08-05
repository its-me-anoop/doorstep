/**
 * BecomeOwner — the use case behind POST /api/v1/onboarding/owner (PRD
 * §6.5 LST-1). A registered `user` becomes a private `owner` in one
 * instant, server-driven step — listings they go on to create are still
 * moderated (PRD §9.3), only their role changes here. Unlike
 * CreateAgency, no new row is created: an owner's `agencyId` stays null.
 *
 * Firebase custom claims are updated (AuthGateway.setRoleClaims) so
 * *future* session mints carry role: 'owner' (PRD §8.4 — "claims refresh
 * on next token refresh, forced after upgrade"). The caller's own
 * still-active session cookie keeps its stale claim until the client
 * completes the refresh dance — lib/firebase-client.ts's
 * refreshSessionAfterUpgrade. That staleness is UX-gating only: every
 * service call re-derives authorisation from the DB `users.role` column
 * (PRD §8.4), never from the claim, so this route being reachable one
 * request early or late never grants a capability the DB role does not.
 */

import type { AuthGateway } from '@/ports/auth-gateway'
import type { User, UserRepository } from '@/ports/user-repository'

import { AccountSuspendedError } from '../auth/errors'
import { requireRole } from '../authz/policies'

export interface BecomeOwnerResult {
  user: User
}

export class BecomeOwner {
  constructor(
    private readonly userRepository: UserRepository,
    private readonly authGateway: AuthGateway,
  ) {}

  async execute(actor: User): Promise<BecomeOwnerResult> {
    if (actor.status !== 'active') {
      throw new AccountSuspendedError(actor.status)
    }
    // Only a plain 'user' can onboard as owner — an agent, an owner
    // already, or an admin all get rejected here rather than silently
    // no-op'd, so a stray retry can't be mistaken for success.
    requireRole(actor, 'user')

    const user = await this.userRepository.update(actor.id, { role: 'owner' })
    await this.authGateway.setRoleClaims(actor.firebaseUid, { role: 'owner' })

    return { user }
  }
}
