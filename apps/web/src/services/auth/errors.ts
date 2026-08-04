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

/**
 * A verified Firebase credential carried no email claim. `users.email` is
 * unique and NOT NULL (PRD §9.2), so on first sign-in ensureUser cannot
 * insert one without either violating that constraint (a second
 * email-less identity) or silently mis-recording the account — instead
 * it rejects the sign-in here. All three M0 providers (email+password,
 * Google, Apple including private relay) always supply an email, so this
 * only fires for a credential this app should not have trusted anyway;
 * the API route's catch-all (not AccountSuspendedError) already maps any
 * such rejection to 401 invalid_credential, so no route change is needed.
 */
export class MissingEmailClaimError extends Error {
  constructor() {
    super('Credential has no email claim')
    this.name = 'MissingEmailClaimError'
  }
}
