/**
 * FirebaseAuthGateway — the AuthGateway (ports/) implementation backed by
 * the Firebase Admin SDK. services/auth/* depend on the port, not this
 * class directly (DIP); this is the only place firebase-admin's
 * `DecodedIdToken` shape is known about. See PRD §8.4.
 */

import type { DecodedIdToken } from 'firebase-admin/auth'
import { getAuth } from 'firebase-admin/auth'

import { isUserRole } from '@/domain/enums'
import type {
  AuthGateway,
  DecodedIdentity,
  RoleClaims,
} from '@/ports/auth-gateway'

import { getAdminApp } from './admin-app'

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

export class FirebaseAuthGateway implements AuthGateway {
  async verifyIdToken(idToken: string): Promise<DecodedIdentity> {
    const decoded = await getAuth(getAdminApp()).verifyIdToken(idToken)
    return toDecodedIdentity(decoded)
  }

  async createSessionCookie(
    idToken: string,
    expiresInMs: number,
  ): Promise<string> {
    return getAuth(getAdminApp()).createSessionCookie(idToken, {
      expiresIn: expiresInMs,
    })
  }

  async verifySessionCookie(cookie: string): Promise<DecodedIdentity> {
    const decoded = await getAuth(getAdminApp()).verifySessionCookie(
      cookie,
      true,
    )
    return toDecodedIdentity(decoded)
  }

  async revokeSessions(uid: string): Promise<void> {
    await getAuth(getAdminApp()).revokeRefreshTokens(uid)
  }

  async setRoleClaims(uid: string, claims: RoleClaims): Promise<void> {
    await getAuth(getAdminApp()).setCustomUserClaims(uid, claims)
  }
}
