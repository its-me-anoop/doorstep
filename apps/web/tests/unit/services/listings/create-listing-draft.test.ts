import { describe, expect, it } from 'vitest'

import type { DraftListingInput } from '@/lib/validation/listing'
import type { User } from '@/ports/user-repository'
import { AccountSuspendedError } from '@/services/auth/errors'
import { ForbiddenError } from '@/services/authz/policies'
import { CreateListingDraft } from '@/services/listings/create-listing-draft'

import { FakeListingRepository } from './fakes'

function user(overrides: Partial<User> = {}): User {
  return {
    id: 'user-1',
    firebaseUid: 'firebase-uid-1',
    email: 'jamie@example.co.uk',
    displayName: 'Jamie Example',
    role: 'owner',
    agencyId: null,
    status: 'active',
    ...overrides,
  }
}

function draftInput(
  overrides: Partial<DraftListingInput> = {},
): DraftListingInput {
  return { channel: 'sale', propertyType: 'flat', ...overrides }
}

function makeSut() {
  const listingRepository = new FakeListingRepository()
  const sut = new CreateListingDraft(listingRepository)
  return { sut, listingRepository }
}

// PRD §6.5 LST-2 step 1 — "channel and property type" is the only
// mandatory input; everything else can be filled in across later wizard
// steps and saved as a draft along the way.
describe('CreateListingDraft', () => {
  it('creates a draft owned by the actor with status draft', async () => {
    const { sut } = makeSut()
    const actor = user()

    const result = await sut.execute(actor, draftInput())

    expect(result.status).toBe('draft')
    expect(result.listerId).toBe('user-1')
    expect(result.channel).toBe('sale')
    expect(result.propertyType).toBe('flat')
    expect(result.publishedAt).toBeNull()
    expect(result.statusChangedAt).toBeNull()
    expect(result.rejectionReason).toBeNull()
  })

  it('sets agencyId to null for an owner-created draft', async () => {
    const { sut } = makeSut()
    const actor = user({ role: 'owner', agencyId: null })

    const result = await sut.execute(actor, draftInput())

    expect(result.agencyId).toBeNull()
  })

  it("sets agencyId to the actor's agency for an agent-created draft", async () => {
    const { sut } = makeSut()
    const actor = user({ role: 'agent', agencyId: 'agency-1' })

    const result = await sut.execute(actor, draftInput())

    expect(result.agencyId).toBe('agency-1')
  })

  it('rejects a plain user (has not onboarded as owner or agent)', async () => {
    const { sut } = makeSut()
    const actor = user({ role: 'user' })

    await expect(sut.execute(actor, draftInput())).rejects.toThrow(
      ForbiddenError,
    )
  })

  it('rejects an admin (not a lister role)', async () => {
    const { sut } = makeSut()
    const actor = user({ role: 'admin' })

    await expect(sut.execute(actor, draftInput())).rejects.toThrow(
      ForbiddenError,
    )
  })

  it('rejects a suspended actor', async () => {
    const { sut } = makeSut()
    const actor = user({ status: 'suspended' })

    await expect(sut.execute(actor, draftInput())).rejects.toThrow(
      AccountSuspendedError,
    )
  })

  it('generates a title and slug from the supplied fields', async () => {
    const { sut } = makeSut()
    const actor = user()

    const result = await sut.execute(
      actor,
      draftInput({
        propertyType: 'semi_detached',
        bedrooms: 3,
        outcode: 'RG30',
      }),
    )

    expect(result.title).toBe('3 bed semi-detached house for sale')
    expect(result.slug).toMatch(/^3-bed-semi-detached-house-rg30-[0-9a-f]{6}$/)
  })

  it('generates a Studio title/slug when bedrooms is omitted (defaults to 0)', async () => {
    const { sut } = makeSut()
    const actor = user()

    const result = await sut.execute(
      actor,
      draftInput({ propertyType: 'flat' }),
    )

    expect(result.title).toBe('Studio flat for sale')
    expect(result.slug).toMatch(/^studio-flat-[0-9a-f]{6}$/)
  })

  it('generates two different drafts with two different slugs', async () => {
    const { sut } = makeSut()
    const actor = user()

    const first = await sut.execute(actor, draftInput())
    const second = await sut.execute(actor, draftInput())

    expect(first.slug).not.toBe(second.slug)
  })

  it('defaults every optional field not supplied by the client', async () => {
    const { sut } = makeSut()
    const actor = user()

    const result = await sut.execute(actor, draftInput())

    expect(result.description).toBe('')
    expect(result.features).toEqual([])
    expect(result.bedrooms).toBe(0)
    expect(result.bathrooms).toBe(0)
    expect(result.price).toBe(0)
    expect(result.priceQualifier).toBe('poa')
    expect(result.tenure).toBeNull()
    expect(result.deposit).toBeNull()
    expect(result.furnished).toBeNull()
    expect(result.availableFrom).toBeNull()
    expect(result.epcRating).toBeNull()
    expect(result.councilTaxBand).toBeNull()
    expect(result.newHome).toBe(false)
    expect(result.addressLine1).toBe('')
    expect(result.displayAddress).toBe('')
    expect(result.town).toBe('')
    expect(result.outcode).toBe('')
    expect(result.postcode).toBe('')
    expect(result.location).toEqual({ lat: 0, lng: 0 })
    expect(result.locationApproximate).toBe(false)
  })

  it('persists every field the client did supply', async () => {
    const { sut } = makeSut()
    const actor = user()

    const result = await sut.execute(
      actor,
      draftInput({
        channel: 'rent',
        propertyType: 'flat',
        description: 'A lovely flat.',
        features: ['Balcony'],
        bedrooms: 2,
        bathrooms: 1,
        price: 1500,
        priceQualifier: 'fixed',
        furnished: 'furnished',
        deposit: 1500,
        epcRating: 'C',
        addressLine1: '1 Example Road',
        displayAddress: 'Example Road, Reading',
        town: 'Reading',
        outcode: 'RG1',
        postcode: 'RG1 1AA',
        location: { lat: 51.45, lng: -0.97 },
        locationApproximate: true,
      }),
    )

    expect(result.description).toBe('A lovely flat.')
    expect(result.features).toEqual(['Balcony'])
    expect(result.bedrooms).toBe(2)
    expect(result.bathrooms).toBe(1)
    expect(result.price).toBe(1500)
    expect(result.priceQualifier).toBe('fixed')
    expect(result.furnished).toBe('furnished')
    expect(result.deposit).toBe(1500)
    expect(result.epcRating).toBe('C')
    expect(result.addressLine1).toBe('1 Example Road')
    expect(result.displayAddress).toBe('Example Road, Reading')
    expect(result.town).toBe('Reading')
    expect(result.outcode).toBe('RG1')
    expect(result.postcode).toBe('RG1 1AA')
    expect(result.location).toEqual({ lat: 51.45, lng: -0.97 })
    expect(result.locationApproximate).toBe(true)
  })
})
