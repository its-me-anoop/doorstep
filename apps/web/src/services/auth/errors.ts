/**
 * Errors thrown by services/auth/*. Route handlers catch these and map
 * them to the { error: { code, message } } envelope (PRD §8.5 — thin
 * handlers: parse, call service, map result); nothing outside services/
 * decides what these mean for authorisation.
 */

import type { UserStatus } from '@/ports/user-repository'

/**
 * A credential verified successfully but the `users` row it resolves to
 * is not `active` (PRD §8.4 authorisation matrix — suspended/banned
 * accounts are rejected even with a cryptographically valid Firebase
 * session).
 */
export class AccountSuspendedError extends Error {
  readonly status: Exclude<UserStatus, 'active'>

  constructor(status: Exclude<UserStatus, 'active'>) {
    super(`Account is ${status}`)
    this.name = 'AccountSuspendedError'
    this.status = status
  }
}

/**
 * A session cookie verified successfully (so the Firebase credential is
 * genuine) but no `users` row exists for its uid. EstablishSession always
 * provisions one on first sign-in, so this only fires for a row deleted
 * out from under a still-valid session — treat it like an invalid
 * session, not a 500.
 */
export class UnknownSessionUserError extends Error {
  constructor() {
    super('No user record for this session')
    this.name = 'UnknownSessionUserError'
  }
}
