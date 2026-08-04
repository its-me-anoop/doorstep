/**
 * services/auth/
 *
 * The auth use cases: EstablishSession (sign-in), TerminateSession
 * (sign-out), GetCurrentUser (session read + sliding-renewal signal).
 * See each file's doc comment and PRD §8.4.
 */

export {
  EstablishSession,
  SESSION_COOKIE_LIFETIME_MS,
} from './establish-session'
export type {
  EstablishSessionInput,
  EstablishSessionResult,
} from './establish-session'

export { TerminateSession } from './terminate-session'

export { GetCurrentUser } from './get-current-user'
export type { GetCurrentUserResult } from './get-current-user'

export { AccountSuspendedError, UnknownSessionUserError } from './errors'
