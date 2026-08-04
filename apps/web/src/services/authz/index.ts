/**
 * services/authz/
 *
 * Pure authorisation policies against the PRD §8.4 capability matrix.
 * See policies.ts's doc comment: services are the only place these
 * decisions are made.
 */

export { ForbiddenError, canManageListing, requireRole } from './policies'
export type { Actor, ListingSubject } from './policies'
