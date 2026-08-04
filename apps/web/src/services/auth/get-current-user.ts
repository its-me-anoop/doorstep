/**
 * GetCurrentUser — verifies a session cookie and loads the app-profile
 * user behind it, rejecting suspended/banned accounts even when the
 * cookie itself is cryptographically valid (PRD §8.4).
 *
 * Also carries the sliding-renewal signal lib/session.ts acts on:
 * `reissue` becomes true once the cookie has passed the midpoint between
 * when it was issued (authTime) and when it expires (expiresAt), so an
 * active user's cookie gets refreshed on ordinary activity instead of
 * silently lapsing mid-session. See establish-session.ts for why that
 * refresh cannot push the credential past Firebase's 14-day ceiling.
 */

import type { AuthGateway, DecodedIdentity } from '@/ports/auth-gateway'
import type { Clock } from '@/ports/clock'
import type { User, UserRepository } from '@/ports/user-repository'

import { AccountSuspendedError, UnknownSessionUserError } from './errors'

export interface GetCurrentUserResult {
  user: User
  identity: DecodedIdentity
  /** True once the cookie has passed the midpoint of its lifetime. */
  reissue: boolean
}

export class GetCurrentUser {
  constructor(
    private readonly authGateway: AuthGateway,
    private readonly userRepository: UserRepository,
    private readonly clock: Clock,
  ) {}

  async execute(sessionCookie: string): Promise<GetCurrentUserResult> {
    const identity = await this.authGateway.verifySessionCookie(sessionCookie)

    const user = await this.userRepository.findByFirebaseUid(identity.uid)
    if (!user) {
      throw new UnknownSessionUserError()
    }
    if (user.status !== 'active') {
      throw new AccountSuspendedError(user.status)
    }

    return {
      user,
      identity,
      reissue: isPastHalfLife(identity, this.clock.now()),
    }
  }
}

function isPastHalfLife(identity: DecodedIdentity, now: Date): boolean {
  const lifetimeMs = identity.expiresAt.getTime() - identity.authTime.getTime()
  const ageMs = now.getTime() - identity.authTime.getTime()
  return ageMs > lifetimeMs / 2
}
