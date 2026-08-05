import { describe, expect, it } from 'vitest'

import type { User } from '@/ports/user-repository'
import { AccountSuspendedError } from '@/services/auth/errors'
import { BecomeOwner } from '@/services/listers/become-owner'
import { ForbiddenError } from '@/services/authz/policies'

import { FakeAuthGateway, FakeUserRepository } from '../auth/fakes'

function user(overrides: Partial<User> = {}): User {
  return {
    id: 'user-1',
    firebaseUid: 'firebase-uid-1',
    email: 'jamie@example.co.uk',
    displayName: 'Jamie Example',
    role: 'user',
    agencyId: null,
    status: 'active',
    ...overrides,
  }
}

function makeSut() {
  const userRepository = new FakeUserRepository()
  const authGateway = new FakeAuthGateway()
  const sut = new BecomeOwner(userRepository, authGateway)
  return { sut, userRepository, authGateway }
}

// PRD §6.5 LST-1 — "I'm a private owner" is an instant role upgrade for a
// registered `user`; listings they create are still moderated (unchanged
// by this use case, which only flips the role).
describe('BecomeOwner', () => {
  it('promotes an active user to owner and returns the updated user', async () => {
    const { sut, userRepository } = makeSut()
    const actor = user()
    userRepository.seed(actor)

    const result = await sut.execute(actor)

    expect(result.user.role).toBe('owner')
    expect(result.user.id).toBe('user-1')
    const stored = await userRepository.findById('user-1')
    expect(stored?.role).toBe('owner')
  })

  it('sets Firebase custom claims to role owner, with no agencyId', async () => {
    const { sut, userRepository, authGateway } = makeSut()
    const actor = user()
    userRepository.seed(actor)

    await sut.execute(actor)

    expect(authGateway.roleClaimsSet).toEqual([
      { uid: 'firebase-uid-1', claims: { role: 'owner' } },
    ])
  })

  it('rejects an actor who is already an owner', async () => {
    const { sut, userRepository } = makeSut()
    const actor = user({ role: 'owner' })
    userRepository.seed(actor)

    await expect(sut.execute(actor)).rejects.toThrow(ForbiddenError)
  })

  it('rejects an agent — already onboarded, cannot re-onboard as owner', async () => {
    const { sut, userRepository } = makeSut()
    const actor = user({ role: 'agent', agencyId: 'agency-1' })
    userRepository.seed(actor)

    await expect(sut.execute(actor)).rejects.toThrow(ForbiddenError)
  })

  it('rejects an admin, leaving their role unchanged', async () => {
    const { sut, userRepository } = makeSut()
    const actor = user({ role: 'admin' })
    userRepository.seed(actor)

    await expect(sut.execute(actor)).rejects.toThrow(ForbiddenError)

    const stored = await userRepository.findById('user-1')
    expect(stored?.role).toBe('admin')
  })

  it('rejects a suspended user even though their role would otherwise qualify', async () => {
    const { sut, userRepository, authGateway } = makeSut()
    const actor = user({ status: 'suspended' })
    userRepository.seed(actor)

    await expect(sut.execute(actor)).rejects.toThrow(AccountSuspendedError)
    expect(authGateway.roleClaimsSet).toHaveLength(0)
  })

  it('rejects a banned user', async () => {
    const { sut, userRepository } = makeSut()
    const actor = user({ status: 'banned' })
    userRepository.seed(actor)

    await expect(sut.execute(actor)).rejects.toThrow(AccountSuspendedError)
  })

  it('does not set claims when the DB update never happens (role check fails first)', async () => {
    const { sut, userRepository, authGateway } = makeSut()
    const actor = user({ role: 'agent', agencyId: 'agency-1' })
    userRepository.seed(actor)

    await expect(sut.execute(actor)).rejects.toThrow(ForbiddenError)
    expect(authGateway.roleClaimsSet).toHaveLength(0)
  })
})
