/**
 * EstablishSession — the one use case behind POST /api/v1/auth/session.
 *
 * Verifies a Firebase ID token, ensures a `users` row exists (creating
 * one with role 'user' and email/display-name mirrored from the token on
 * first sign-in — PRD §9.2), then mints a session cookie. Suspended and
 * banned users are rejected here, in the service, even though their
 * Firebase credential is perfectly valid — PRD §8.5 is explicit that
 * authorisation is a service-layer concern, never a route handler's.
 */

import type { AuthGateway } from '@/ports/auth-gateway'
import type { Clock } from '@/ports/clock'
import {
  UniqueViolationError,
  type User,
  type UserRepository,
} from '@/ports/user-repository'

import { AccountSuspendedError, MissingEmailClaimError } from './errors'

/**
 * Firebase's own hard ceiling for session cookies (PRD §8.4). Sliding
 * renewal (services/auth/get-current-user.ts, lib/session.ts) operates
 * within this window — it cannot extend past it.
 */
export const SESSION_COOKIE_LIFETIME_MS = 14 * 24 * 60 * 60 * 1000

export interface EstablishSessionInput {
  idToken: string
}

export interface EstablishSessionResult {
  sessionCookie: string
  user: User
  expiresAt: Date
}

export class EstablishSession {
  constructor(
    private readonly authGateway: AuthGateway,
    private readonly userRepository: UserRepository,
    private readonly clock: Clock,
  ) {}

  async execute(input: EstablishSessionInput): Promise<EstablishSessionResult> {
    const identity = await this.authGateway.verifyIdToken(input.idToken)

    const user = await this.ensureUser(identity)
    if (user.status !== 'active') {
      throw new AccountSuspendedError(user.status)
    }

    const sessionCookie = await this.authGateway.createSessionCookie(
      input.idToken,
      SESSION_COOKIE_LIFETIME_MS,
    )

    return {
      sessionCookie,
      user,
      expiresAt: new Date(
        this.clock.now().getTime() + SESSION_COOKIE_LIFETIME_MS,
      ),
    }
  }

  private async ensureUser(identity: {
    uid: string
    email?: string
    displayName?: string
  }): Promise<User> {
    const existing = await this.userRepository.findByFirebaseUid(identity.uid)
    if (existing) return existing

    // users.email is unique and NOT NULL — inserting '' for an
    // email-less identity would only collide with the next one. All
    // three M0 providers always supply an email, so a missing one means
    // this credential should never have reached provisioning.
    if (!identity.email) {
      throw new MissingEmailClaimError()
    }

    try {
      return await this.userRepository.create({
        firebaseUid: identity.uid,
        email: identity.email,
        displayName: identity.displayName ?? identity.email,
        role: 'user',
        agencyId: null,
        status: 'active',
      })
    } catch (error) {
      if (
        error instanceof UniqueViolationError &&
        error.field === 'firebaseUid'
      ) {
        // Two concurrent first sign-ins for the same uid: the other one
        // won the race and already inserted the row — read it back
        // instead of failing this request.
        const raceWinner = await this.userRepository.findByFirebaseUid(
          identity.uid,
        )
        if (raceWinner) return raceWinner
      }
      throw error
    }
  }
}
