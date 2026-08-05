import { describe, expect, it } from 'vitest'

import type { CreateAgencyInput } from '@/lib/validation/agency'
import type { User } from '@/ports/user-repository'
import { AccountSuspendedError } from '@/services/auth/errors'
import { ForbiddenError } from '@/services/authz/policies'
import { CreateAgency } from '@/services/listers/create-agency'

import { FakeAuthGateway, FakeUserRepository } from '../auth/fakes'
import { FakeAgencyRepository } from './fakes'

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

function agencyInput(
  overrides: Partial<CreateAgencyInput> = {},
): CreateAgencyInput {
  return {
    name: 'Thameside Property Partners',
    phone: '0118 950 1147',
    email: 'hello@thamesidepropertypartners.co.uk',
    website: 'https://www.thamesidepropertypartners.co.uk',
    address: '12 Kings Road, Reading, RG1 3AA',
    ...overrides,
  }
}

function makeSut() {
  const agencyRepository = new FakeAgencyRepository()
  const userRepository = new FakeUserRepository()
  const authGateway = new FakeAuthGateway()
  const sut = new CreateAgency(agencyRepository, userRepository, authGateway)
  return { sut, agencyRepository, userRepository, authGateway }
}

// PRD §6.5 LST-1 — "I'm an agent" creates a new agency (name, contact
// details; starts unverified) and promotes the actor to `agent` on it.
// Joining an *existing* agency (approved by its creator) is explicitly
// deferred past M1 — see the route's doc comment.
describe('CreateAgency', () => {
  it('creates an unverified agency owned by the actor', async () => {
    const { sut, userRepository } = makeSut()
    const actor = user()
    userRepository.seed(actor)

    const result = await sut.execute(actor, agencyInput())

    expect(result.agency.name).toBe('Thameside Property Partners')
    expect(result.agency.slug).toBe('thameside-property-partners')
    expect(result.agency.phone).toBe('0118 950 1147')
    expect(result.agency.email).toBe('hello@thamesidepropertypartners.co.uk')
    expect(result.agency.website).toBe(
      'https://www.thamesidepropertypartners.co.uk',
    )
    expect(result.agency.address).toBe('12 Kings Road, Reading, RG1 3AA')
    expect(result.agency.verified).toBe(false)
    expect(result.agency.createdBy).toBe('user-1')
    expect(result.agency.logoPath).toBeNull()
  })

  it('promotes the actor to agent on the new agency', async () => {
    const { sut, userRepository } = makeSut()
    const actor = user()
    userRepository.seed(actor)

    const result = await sut.execute(actor, agencyInput())

    expect(result.user.role).toBe('agent')
    expect(result.user.agencyId).toBe(result.agency.id)
    const stored = await userRepository.findById('user-1')
    expect(stored?.role).toBe('agent')
    expect(stored?.agencyId).toBe(result.agency.id)
  })

  it('sets Firebase custom claims to role agent with the new agencyId', async () => {
    const { sut, userRepository, authGateway } = makeSut()
    const actor = user()
    userRepository.seed(actor)

    const result = await sut.execute(actor, agencyInput())

    expect(authGateway.roleClaimsSet).toEqual([
      {
        uid: 'firebase-uid-1',
        claims: { role: 'agent', agencyId: result.agency.id },
      },
    ])
  })

  it('allows an existing private owner to create an agency', async () => {
    const { sut, userRepository } = makeSut()
    const actor = user({ role: 'owner' })
    userRepository.seed(actor)

    const result = await sut.execute(actor, agencyInput())

    expect(result.user.role).toBe('agent')
  })

  it('rejects an agent — already onboarded, cannot re-onboard', async () => {
    const { sut, userRepository } = makeSut()
    const actor = user({ role: 'agent', agencyId: 'agency-existing' })
    userRepository.seed(actor)

    await expect(sut.execute(actor, agencyInput())).rejects.toThrow(
      ForbiddenError,
    )
  })

  it('rejects an admin, leaving their role unchanged', async () => {
    const { sut, userRepository } = makeSut()
    const actor = user({ role: 'admin' })
    userRepository.seed(actor)

    await expect(sut.execute(actor, agencyInput())).rejects.toThrow(
      ForbiddenError,
    )

    const stored = await userRepository.findById('user-1')
    expect(stored?.role).toBe('admin')
  })

  it('rejects a suspended actor and creates no agency', async () => {
    const { sut, userRepository, agencyRepository } = makeSut()
    const actor = user({ status: 'suspended' })
    userRepository.seed(actor)

    await expect(sut.execute(actor, agencyInput())).rejects.toThrow(
      AccountSuspendedError,
    )
    expect(
      await agencyRepository.findBySlug('thameside-property-partners'),
    ).toBeNull()
  })

  it('rejects a banned actor', async () => {
    const { sut, userRepository } = makeSut()
    const actor = user({ status: 'banned' })
    userRepository.seed(actor)

    await expect(sut.execute(actor, agencyInput())).rejects.toThrow(
      AccountSuspendedError,
    )
  })

  it('dedupes the slug against an existing agency with a numeric suffix', async () => {
    const { sut, userRepository, agencyRepository } = makeSut()
    const actor = user()
    userRepository.seed(actor)
    agencyRepository.seed({
      id: 'agency-existing',
      name: 'Thameside Property Partners',
      slug: 'thameside-property-partners',
      logoPath: null,
      phone: '0118 000 0000',
      email: 'other@example.co.uk',
      website: 'https://example.co.uk',
      address: 'Somewhere else',
      verified: true,
      createdBy: 'someone-else',
      createdAt: new Date(),
      updatedAt: new Date(),
    })

    const result = await sut.execute(actor, agencyInput())

    expect(result.agency.slug).toBe('thameside-property-partners-2')
  })

  it('dedupes past multiple existing slugs to the next free suffix', async () => {
    const { sut, userRepository, agencyRepository } = makeSut()
    const actor = user()
    userRepository.seed(actor)
    for (const slug of [
      'thameside-property-partners',
      'thameside-property-partners-2',
      'thameside-property-partners-3',
    ]) {
      agencyRepository.seed({
        id: `agency-${slug}`,
        name: 'Thameside Property Partners',
        slug,
        logoPath: null,
        phone: '0118 000 0000',
        email: 'other@example.co.uk',
        website: 'https://example.co.uk',
        address: 'Somewhere else',
        verified: true,
        createdBy: 'someone-else',
        createdAt: new Date(),
        updatedAt: new Date(),
      })
    }

    const result = await sut.execute(actor, agencyInput())

    expect(result.agency.slug).toBe('thameside-property-partners-4')
  })

  it('recovers from a create-time slug race by retrying once against current state', async () => {
    const { sut, userRepository, agencyRepository } = makeSut()
    const actor = user()
    userRepository.seed(actor)
    // Simulates a second, concurrent onboarding request for an
    // identically-named agency: by the time this request's create() runs,
    // the other request has already inserted the deduped slug this
    // request's own pre-check found free, so this create() hits the
    // agencies.slug unique constraint.
    agencyRepository.runBeforeNextCreate(() => {
      agencyRepository.seed({
        id: 'agency-race-winner',
        name: 'Thameside Property Partners',
        slug: 'thameside-property-partners',
        logoPath: null,
        phone: '0118 000 0000',
        email: 'other@example.co.uk',
        website: 'https://example.co.uk',
        address: 'Somewhere else',
        verified: true,
        createdBy: 'someone-else',
        createdAt: new Date(),
        updatedAt: new Date(),
      })
    })

    const result = await sut.execute(actor, agencyInput())

    expect(result.agency.slug).toBe('thameside-property-partners-2')
  })

  it('does not mistake an unrelated repository failure for a slug race', async () => {
    const { sut, userRepository, agencyRepository } = makeSut()
    const actor = user()
    userRepository.seed(actor)
    const connectionError = new Error('connection reset by peer')
    agencyRepository.runBeforeNextCreate(() => {
      throw connectionError
    })

    await expect(sut.execute(actor, agencyInput())).rejects.toThrow(
      connectionError,
    )
  })
})
