import { describe, expect, it } from 'vitest'

import { TerminateSession } from '@/services/auth/terminate-session'

import { FakeAuthGateway } from './fakes'

describe('TerminateSession', () => {
  it('revokes every session for the cookie owner', async () => {
    const authGateway = new FakeAuthGateway()
    authGateway.seedCredential('cookie-1', {
      uid: 'firebase-uid-1',
      role: 'user',
      authTime: new Date('2026-08-04T00:00:00Z'),
      expiresAt: new Date('2026-08-18T00:00:00Z'),
    })
    const sut = new TerminateSession(authGateway)

    await sut.execute('cookie-1')

    expect(authGateway.revokedUids).toEqual(['firebase-uid-1'])
  })

  it('is a no-op when there is no cookie', async () => {
    const authGateway = new FakeAuthGateway()
    const sut = new TerminateSession(authGateway)

    await expect(sut.execute(null)).resolves.toBeUndefined()
    expect(authGateway.revokedUids).toEqual([])
  })

  it('is a no-op (not a throw) for an already-invalid cookie', async () => {
    const authGateway = new FakeAuthGateway()
    const sut = new TerminateSession(authGateway)

    await expect(sut.execute('stale-cookie')).resolves.toBeUndefined()
    expect(authGateway.revokedUids).toEqual([])
  })
})
