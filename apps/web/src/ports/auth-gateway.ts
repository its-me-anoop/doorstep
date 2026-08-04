/**
 * AuthGateway — fronts Firebase Auth (Admin SDK) for everything services/
 * need to do server-side with an identity: verify credentials, manage the
 * session-cookie lifecycle, and set the role/agency custom claims that
 * back the PRD §8.4 authorisation matrix. adapters/firebase implements
 * this; services/auth/* depend only on this interface (DIP), so they can
 * be unit tested with an in-memory fake instead of a real Firebase
 * project (none is available locally — see PRD §8.4).
 */

import type { UserRole } from '@/domain/enums'

/**
 * The identity claims services care about, projected from either a
 * Firebase ID token or a Firebase session cookie — both decode to this
 * same shape so EstablishSession/GetCurrentUser don't need to know which
 * one they were handed.
 */
export interface DecodedIdentity {
  uid: string
  email?: string
  /**
   * Mirrors the Firebase ID token's `name` claim when present. Used only
   * to seed `users.display_name` on first sign-in (PRD §9.2) — never
   * relied on for anything security-relevant.
   */
  displayName?: string
  /** Defaults to 'user' when the token/cookie carries no role claim. */
  role: UserRole
  agencyId?: string
  /** When the credential was issued. */
  authTime: Date
  /** When the credential stops being valid. */
  expiresAt: Date
}

export interface RoleClaims {
  role: UserRole
  agencyId?: string
}

export interface AuthGateway {
  /** Verifies a client-supplied Firebase ID token (fresh sign-in). */
  verifyIdToken(idToken: string): Promise<DecodedIdentity>
  /**
   * Exchanges a verified ID token for a Firebase session cookie.
   * `expiresInMs` is capped by Firebase at 14 days — see
   * services/auth/establish-session.ts.
   */
  createSessionCookie(idToken: string, expiresInMs: number): Promise<string>
  /** Verifies a session cookie previously minted by createSessionCookie. */
  verifySessionCookie(cookie: string): Promise<DecodedIdentity>
  /**
   * Revokes every refresh token (and therefore every session cookie and
   * ID token derived since) for a uid — used on sign-out and account
   * suspension.
   */
  revokeSessions(uid: string): Promise<void>
  /** Sets the role/agencyId custom claims baked into future tokens. */
  setRoleClaims(uid: string, claims: RoleClaims): Promise<void>
}
