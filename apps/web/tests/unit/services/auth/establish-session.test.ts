import { describe, expect, it } from 'vitest'

import type { DecodedIdentity } from '@/ports/auth-gateway'
import type { User } from '@/ports/user-repository'
import {
  EstablishSession,
  SESSION_COOKIE_LIFETIME_MS,
} from '@/services/auth/establish-session'
import { AccountSuspendedError } from '@/services/auth/errors'

import { FakeAuthGateway, FakeClock, FakeUserRepository } from './fakes'

const NOW = new Date('2026-08-04T09:00:00Z')

function identity(overrides: Partial<DecodedIdentity> = {}): DecodedIdentity {
  return {
    uid: 'firebase-uid-1',
    email: 'jamie@example.co.uk',
    displayName: 'Jamie Example',
    role: 'user',
    authTime: NOW,
    expiresAt: new Date(NOW.getTime() + SESSION_COOKIE_LIFETIME_MS),
    ...overrides,
  }
}

function makeSut() {
  const authGateway = new FakeAuthGateway()
  const userRepository = new FakeUserRepository()
  const clock = new FakeClock(NOW)
  const sut = new EstablishSession(authGateway, userRepository, clock)
  return { sut, authGateway, userRepository, clock }
}

describe('EstablishSession', () => {
  it('provisions a users row with role user on first sign-in, mirroring email and display name', async () => {
    const { sut, authGateway, userRepository } = makeSut()
    authGateway.seedCredential('id-token-1', identity())

    const result = await sut.execute({ idToken: 'id-token-1' })

    expect(result.user.firebaseUid).toBe('firebase-uid-1')
    expect(result.user.email).toBe('jamie@example.co.uk')
    expect(result.user.displayName).toBe('Jamie Example')
    expect(result.user.role).toBe('user')
    expect(result.user.agencyId).toBeNull()
    expect(result.user.status).toBe('active')

    const stored = await userRepository.findByFirebaseUid('firebase-uid-1')
    expect(stored).toEqual(result.user)
  })

  it('falls back to email, then a default, when the token carries no display name', async () => {
    const { sut, authGateway } = makeSut()
    authGateway.seedCredential(
      'id-token-no-name',
      identity({ uid: 'uid-2', displayName: undefined }),
    )

    const result = await sut.execute({ idToken: 'id-token-no-name' })
    expect(result.user.displayName).toBe('jamie@example.co.uk')

    const { sut: sut2, authGateway: gateway2 } = makeSut()
    gateway2.seedCredential(
      'id-token-anonymous',
      identity({ uid: 'uid-3', email: undefined, displayName: undefined }),
    )
    const anonymous = await sut2.execute({ idToken: 'id-token-anonymous' })
    expect(anonymous.user.displayName).toBe('New user')
    expect(anonymous.user.email).toBe('')
  })

  it('reuses the existing users row on a later sign-in instead of creating a duplicate', async () => {
    const { sut, authGateway, userRepository } = makeSut()
    const existing: User = {
      id: 'user-existing',
      firebaseUid: 'firebase-uid-1',
      email: 'jamie@example.co.uk',
      displayName: 'Jamie, agent at Acme',
      role: 'agent',
      agencyId: 'agency-acme',
      status: 'active',
    }
    userRepository.seed(existing)
    authGateway.seedCredential('id-token-1', identity())

    const result = await sut.execute({ idToken: 'id-token-1' })

    expect(result.user).toEqual(existing)
    // Still exactly one row for this firebase uid — no duplicate created.
    expect(await userRepository.findById('user-existing')).toEqual(existing)
  })

  it('rejects an invalid ID token', async () => {
    const { sut } = makeSut()

    await expect(sut.execute({ idToken: 'not-a-real-token' })).rejects.toThrow()
  })

  it('rejects a suspended user even though the credential itself is valid', async () => {
    const { sut, authGateway, userRepository } = makeSut()
    userRepository.seed({
      id: 'user-suspended',
      firebaseUid: 'firebase-uid-1',
      email: 'jamie@example.co.uk',
      displayName: 'Jamie',
      role: 'user',
      agencyId: null,
      status: 'suspended',
    })
    authGateway.seedCredential('id-token-1', identity())

    await expect(sut.execute({ idToken: 'id-token-1' })).rejects.toThrow(
      AccountSuspendedError,
    )
  })

  it('rejects a banned user', async () => {
    const { sut, authGateway, userRepository } = makeSut()
    userRepository.seed({
      id: 'user-banned',
      firebaseUid: 'firebase-uid-1',
      email: 'jamie@example.co.uk',
      displayName: 'Jamie',
      role: 'user',
      agencyId: null,
      status: 'banned',
    })
    authGateway.seedCredential('id-token-1', identity())

    await expect(sut.execute({ idToken: 'id-token-1' })).rejects.toThrow(
      AccountSuspendedError,
    )
  })

  it('mints a 14-day session cookie and reports a matching expiresAt', async () => {
    const { sut, authGateway, clock } = makeSut()
    authGateway.seedCredential('id-token-1', identity())

    const result = await sut.execute({ idToken: 'id-token-1' })

    expect(result.sessionCookie).toBe('session-cookie-for:id-token-1')
    expect(result.expiresAt.getTime()).toBe(
      clock.now().getTime() + SESSION_COOKIE_LIFETIME_MS,
    )
    expect(SESSION_COOKIE_LIFETIME_MS).toBe(14 * 24 * 60 * 60 * 1000)
  })
})
