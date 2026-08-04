import { describe, expect, it } from 'vitest'

import type { DecodedIdentity } from '@/ports/auth-gateway'
import type { User } from '@/ports/user-repository'
import { GetCurrentUser } from '@/services/auth/get-current-user'
import {
  AccountSuspendedError,
  UnknownSessionUserError,
} from '@/services/auth/errors'

import { FakeAuthGateway, FakeClock, FakeUserRepository } from './fakes'

const ISSUED_AT = new Date('2026-08-04T00:00:00Z')
const LIFETIME_MS = 14 * 24 * 60 * 60 * 1000
const EXPIRES_AT = new Date(ISSUED_AT.getTime() + LIFETIME_MS)
const HALF_LIFE = new Date(ISSUED_AT.getTime() + LIFETIME_MS / 2)

const ACTIVE_USER: User = {
  id: 'user-1',
  firebaseUid: 'firebase-uid-1',
  email: 'jamie@example.co.uk',
  displayName: 'Jamie',
  role: 'user',
  agencyId: null,
  status: 'active',
}

function identity(overrides: Partial<DecodedIdentity> = {}): DecodedIdentity {
  return {
    uid: 'firebase-uid-1',
    email: 'jamie@example.co.uk',
    role: 'user',
    authTime: ISSUED_AT,
    expiresAt: EXPIRES_AT,
    ...overrides,
  }
}

function makeSut(now: Date) {
  const authGateway = new FakeAuthGateway()
  const userRepository = new FakeUserRepository()
  const clock = new FakeClock(now)
  const sut = new GetCurrentUser(authGateway, userRepository, clock)
  return { sut, authGateway, userRepository, clock }
}

describe('GetCurrentUser', () => {
  it('returns the user for a valid, fresh session cookie', async () => {
    const { sut, authGateway, userRepository } = makeSut(
      new Date(ISSUED_AT.getTime() + 1000),
    )
    userRepository.seed(ACTIVE_USER)
    authGateway.seedCredential('cookie-1', identity())

    const result = await sut.execute('cookie-1')

    expect(result.user).toEqual(ACTIVE_USER)
    expect(result.reissue).toBe(false)
  })

  it('rejects an invalid or expired session cookie', async () => {
    const { sut } = makeSut(ISSUED_AT)

    await expect(sut.execute('not-a-real-cookie')).rejects.toThrow()
  })

  it('rejects a suspended user even with a valid cookie', async () => {
    const { sut, authGateway, userRepository } = makeSut(ISSUED_AT)
    userRepository.seed({ ...ACTIVE_USER, status: 'suspended' })
    authGateway.seedCredential('cookie-1', identity())

    await expect(sut.execute('cookie-1')).rejects.toThrow(AccountSuspendedError)
  })

  it('rejects a banned user even with a valid cookie', async () => {
    const { sut, authGateway, userRepository } = makeSut(ISSUED_AT)
    userRepository.seed({ ...ACTIVE_USER, status: 'banned' })
    authGateway.seedCredential('cookie-1', identity())

    await expect(sut.execute('cookie-1')).rejects.toThrow(AccountSuspendedError)
  })

  it('throws UnknownSessionUserError when the cookie is valid but the user row is gone', async () => {
    const { sut, authGateway } = makeSut(ISSUED_AT)
    authGateway.seedCredential('cookie-1', identity())
    // No userRepository.seed() call — row missing.

    await expect(sut.execute('cookie-1')).rejects.toThrow(
      UnknownSessionUserError,
    )
  })

  describe('sliding-renewal boundary (reissue signals once past half-life)', () => {
    it('does not signal reissue one second before half-life', async () => {
      const { sut, authGateway, userRepository } = makeSut(
        new Date(HALF_LIFE.getTime() - 1000),
      )
      userRepository.seed(ACTIVE_USER)
      authGateway.seedCredential('cookie-1', identity())

      const result = await sut.execute('cookie-1')
      expect(result.reissue).toBe(false)
    })

    it('does not signal reissue exactly at half-life', async () => {
      const { sut, authGateway, userRepository } = makeSut(HALF_LIFE)
      userRepository.seed(ACTIVE_USER)
      authGateway.seedCredential('cookie-1', identity())

      const result = await sut.execute('cookie-1')
      expect(result.reissue).toBe(false)
    })

    it('signals reissue one second after half-life', async () => {
      const { sut, authGateway, userRepository } = makeSut(
        new Date(HALF_LIFE.getTime() + 1000),
      )
      userRepository.seed(ACTIVE_USER)
      authGateway.seedCredential('cookie-1', identity())

      const result = await sut.execute('cookie-1')
      expect(result.reissue).toBe(true)
    })

    it('still signals reissue right up to expiry', async () => {
      const { sut, authGateway, userRepository } = makeSut(
        new Date(EXPIRES_AT.getTime() - 1),
      )
      userRepository.seed(ACTIVE_USER)
      authGateway.seedCredential('cookie-1', identity())

      const result = await sut.execute('cookie-1')
      expect(result.reissue).toBe(true)
    })
  })
})
