import { describe, expect, it } from 'vitest'

import type { UserRole } from '@/domain/enums'
import {
  ForbiddenError,
  canManageListing,
  requireRole,
  type Actor,
  type ListingSubject,
} from '@/services/authz/policies'

function actor(overrides: Partial<Actor> = {}): Actor {
  return { id: 'actor-1', role: 'owner', agencyId: null, ...overrides }
}

const OWN_LISTING: ListingSubject = {
  listerId: 'actor-1',
  agencyId: null,
}

const OTHERS_LISTING: ListingSubject = {
  listerId: 'someone-else',
  agencyId: 'agency-other',
}

// PRD §8.4 capability matrix rows relevant to M0:
//   "Create and edit own listings"       — no guest/user, yes owner/agent/admin
//   "Edit agency listings (same agencyId)" — agent/admin only
describe('canManageListing', () => {
  it('admin can manage any listing, regardless of ownership or agency', () => {
    expect(canManageListing(actor({ role: 'admin' }), OWN_LISTING)).toBe(true)
    expect(canManageListing(actor({ role: 'admin' }), OTHERS_LISTING)).toBe(
      true,
    )
  })

  it('owner can manage their own listing', () => {
    expect(
      canManageListing(actor({ role: 'owner', id: 'actor-1' }), OWN_LISTING),
    ).toBe(true)
  })

  it('owner cannot manage a listing that is not theirs', () => {
    expect(
      canManageListing(actor({ role: 'owner', id: 'actor-1' }), OTHERS_LISTING),
    ).toBe(false)
  })

  it('agent can manage their own listing', () => {
    expect(
      canManageListing(actor({ role: 'agent', id: 'actor-1' }), OWN_LISTING),
    ).toBe(true)
  })

  it("agent can manage another lister's listing in the same agency", () => {
    const agencyActor = actor({
      role: 'agent',
      id: 'agent-1',
      agencyId: 'agency-other',
    })
    expect(canManageListing(agencyActor, OTHERS_LISTING)).toBe(true)
  })

  it('agent cannot manage a listing in a different agency', () => {
    const agencyActor = actor({
      role: 'agent',
      id: 'agent-1',
      agencyId: 'agency-mine',
    })
    expect(canManageListing(agencyActor, OTHERS_LISTING)).toBe(false)
  })

  it("agent with no agencyId cannot manage another agency's listing via a null/null coincidence", () => {
    const unassignedAgent = actor({
      role: 'agent',
      id: 'agent-1',
      agencyId: null,
    })
    const unassignedListing: ListingSubject = {
      listerId: 'someone-else',
      agencyId: null,
    }
    expect(canManageListing(unassignedAgent, unassignedListing)).toBe(false)
  })

  it('user can never manage a listing, even one that appears to be "theirs"', () => {
    // A 'user' role can never actually be a listing's listerId (creating a
    // listing requires owner/agent/admin), but the policy must not treat
    // an id match as sufficient on its own — it is gated on role too.
    const userActor = actor({ role: 'user', id: 'actor-1' })
    expect(canManageListing(userActor, OWN_LISTING)).toBe(false)
  })
})

// PRD §8.4 row "Moderate, manage users, view admin analytics" — admin only.
describe('requireRole', () => {
  const ALL_ROLES: UserRole[] = ['user', 'owner', 'agent', 'admin']

  it('does not throw when the actor has one of the required roles', () => {
    expect(() => requireRole(actor({ role: 'admin' }), 'admin')).not.toThrow()
    expect(() =>
      requireRole(actor({ role: 'agent' }), 'owner', 'agent', 'admin'),
    ).not.toThrow()
  })

  it.each(ALL_ROLES.filter((role) => role !== 'admin'))(
    'throws ForbiddenError for role %s when admin is required',
    (role) => {
      expect(() => requireRole(actor({ role }), 'admin')).toThrow(
        ForbiddenError,
      )
    },
  )

  it('throws ForbiddenError for guests represented as a role outside the allowed set', () => {
    expect(() =>
      requireRole(actor({ role: 'user' }), 'owner', 'agent', 'admin'),
    ).toThrow(ForbiddenError)
  })
})
