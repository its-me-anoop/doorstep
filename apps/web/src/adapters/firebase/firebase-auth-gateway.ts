/**
 * FirebaseAuthGateway — the AuthGateway (ports/) implementation backed by
 * the Firebase Admin SDK. services/auth/* depend on the port, not this
 * class directly (DIP); this is the only place firebase-admin's
 * `DecodedIdToken` shape is known about. See PRD §8.4.
 */

import type { Auth, DecodedIdToken } from 'firebase-admin/auth'

import { isUserRole } from '@/domain/enums'
import {
  InvalidTokenError,
  type AuthGateway,
  type DecodedIdentity,
  type RoleClaims,
} from '@/ports/auth-gateway'

import { getAdminApp } from './admin-app'

/**
 * firebase-admin reports credential-shaped failures with `auth/*` error
 * codes (expired, malformed, revoked, wrong audience…). Those — and only
 * those — become the port's InvalidTokenError; anything else (network,
 * misconfigured service account) propagates raw so callers can treat it
 * as the infrastructure failure it is.
 */
function rethrowCredentialFailure(error: unknown): never {
  const code =
    (error as { errorInfo?: { code?: string }; code?: string })?.errorInfo
      ?.code ?? (error as { code?: string })?.code
  if (typeof code === 'string' && code.startsWith('auth/')) {
    throw new InvalidTokenError(`Firebase rejected the credential (${code})`, {
      cause: error,
    })
  }
  throw error
}

/** Pure mapper: firebase-admin's decoded token/cookie -> the port's
 * DecodedIdentity. Unit-tested directly (no Admin SDK call needed) —
 * the class below is exercised by services/auth/*'s integration path,
 * which has no live Firebase project locally. */
export function toDecodedIdentity(decoded: DecodedIdToken): DecodedIdentity {
  return {
    uid: decoded.uid,
    email: decoded.email,
    displayName: typeof decoded.name === 'string' ? decoded.name : undefined,
    role: isUserRole(decoded.role) ? decoded.role : 'user',
    agencyId:
      typeof decoded.agencyId === 'string' ? decoded.agencyId : undefined,
    authTime: new Date(decoded.auth_time * 1000),
    expiresAt: new Date(decoded.exp * 1000),
  }
}

/** firebase-admin/auth is dynamic-imported for the same reason as in
 * admin-app.ts: a top-level import would make every consumer of the
 * composition root fail to load on runtimes where firebase-admin's
 * dependency graph cannot be require()d. */
async function adminAuth(): Promise<Auth> {
  const { getAuth } = await import('firebase-admin/auth')
  return getAuth(await getAdminApp())
}

export class FirebaseAuthGateway implements AuthGateway {
  async verifyIdToken(idToken: string): Promise<DecodedIdentity> {
    try {
      const decoded = await (await adminAuth()).verifyIdToken(idToken)
      return toDecodedIdentity(decoded)
    } catch (error) {
      rethrowCredentialFailure(error)
    }
  }

  async createSessionCookie(
    idToken: string,
    expiresInMs: number,
  ): Promise<string> {
    try {
      return await (
        await adminAuth()
      ).createSessionCookie(idToken, {
        expiresIn: expiresInMs,
      })
    } catch (error) {
      rethrowCredentialFailure(error)
    }
  }

  async verifySessionCookie(cookie: string): Promise<DecodedIdentity> {
    try {
      const decoded = await (
        await adminAuth()
      ).verifySessionCookie(cookie, true)
      return toDecodedIdentity(decoded)
    } catch (error) {
      rethrowCredentialFailure(error)
    }
  }

  async revokeSessions(uid: string): Promise<void> {
    await (await adminAuth()).revokeRefreshTokens(uid)
  }

  async setRoleClaims(uid: string, claims: RoleClaims): Promise<void> {
    await (await adminAuth()).setCustomUserClaims(uid, claims)
  }
}
