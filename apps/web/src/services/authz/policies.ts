/**
 * services/authz/policies.ts — pure authorisation rules against the PRD
 * §8.4 capability matrix.
 *
 * These are the ONLY place authorisation decisions get made. A route
 * handler calls a policy function (or requireRole) and maps the
 * result/thrown error to an HTTP status; it never inlines a role check
 * or an ownership comparison of its own (PRD §8.5: "route handlers are
 * thin — parse, call service, map result"; PRD §7.4: role/agency claims
 * are "re-checked server-side on every mutation, never trust the
 * client"). Every service that performs a listing mutation calls
 * canManageListing before touching data; every admin-only use case calls
 * requireRole(actor, 'admin') first.
 *
 * Pure functions only — no ports, no I/O — so they need no fakes to
 * test.
 */

import type { UserRole } from '@/domain/enums'

/** The subset of a `users` row an authorisation decision needs. */
export interface Actor {
  id: string
  role: UserRole
  agencyId: string | null
}

/** The subset of a `properties` row an authorisation decision needs. */
export interface ListingSubject {
  listerId: string
  agencyId: string | null
}

export class ForbiddenError extends Error {
  constructor(message = 'Forbidden') {
    super(message)
    this.name = 'ForbiddenError'
  }
}

/**
 * PRD §8.4 rows:
 *  - "Create and edit own listings" — owner/agent/admin, own listings only.
 *  - "Edit agency listings (same agencyId)" — agent/admin only.
 */
export function canManageListing(
  actor: Actor,
  listing: ListingSubject,
): boolean {
  if (actor.role === 'admin') return true
  if (actor.role === 'user') return false

  if (actor.id === listing.listerId) return true

  return (
    actor.role === 'agent' &&
    actor.agencyId !== null &&
    actor.agencyId === listing.agencyId
  )
}

/**
 * PRD §8.4 row "Moderate, manage users, view admin analytics" (and any
 * other role-gated capability) — throws ForbiddenError when the actor's
 * role is not one of `roles`.
 */
export function requireRole(actor: Actor, ...roles: readonly UserRole[]): void {
  if (!roles.includes(actor.role)) {
    throw new ForbiddenError(
      `Requires role ${roles.join(' or ')}, actor has role ${actor.role}`,
    )
  }
}
