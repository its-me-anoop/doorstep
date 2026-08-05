import { describe, expect, it } from 'vitest'

import type { PropertyImage } from '@/ports/property-image-repository'
import { GetCoverBlurhashes } from '@/services/images/get-cover-blurhashes'

import { FakePropertyImageRepository } from './fakes'

function image(overrides: Partial<PropertyImage> = {}): PropertyImage {
  return {
    id: 'img-1',
    propertyId: 'listing-1',
    kind: 'photo',
    storagePath: 'listings/listing-1/original/img-1',
    position: 0,
    width: 400,
    height: 300,
    blurhash: 'LGF5?xYk^6#M@-5c,1J5@[or[Q6.',
    altText: null,
    createdAt: new Date('2026-01-01T00:00:00Z'),
    updatedAt: new Date('2026-01-01T00:00:00Z'),
    ...overrides,
  }
}

function makeSut() {
  const propertyImageRepository = new FakePropertyImageRepository()
  const sut = new GetCoverBlurhashes(propertyImageRepository)
  return { sut, propertyImageRepository }
}

// M1-DESIGN-SPEC.md §4.2: "blurhash placeholder until the real cover
// loads" — the my-listings dashboard row's cover thumbnail. No
// actor/authz parameter: the listing ids passed in are the ones the
// caller already resolved through an authorised read (ListMyListings),
// so this is a pure display-data lookup over ids the caller has already
// established the actor may see, not a new authorization boundary.
describe('GetCoverBlurhashes', () => {
  it('returns an empty map for an empty id list', async () => {
    const { sut } = makeSut()

    await expect(sut.execute([])).resolves.toEqual(new Map())
  })

  it('maps a listing id to its position-0 image blurhash', async () => {
    const { sut, propertyImageRepository } = makeSut()
    propertyImageRepository.seed(image({ id: 'img-1', position: 0 }))

    const result = await sut.execute(['listing-1'])

    expect(result.get('listing-1')).toBe('LGF5?xYk^6#M@-5c,1J5@[or[Q6.')
  })

  it('picks the position-0 image, not just the first one seeded', async () => {
    const { sut, propertyImageRepository } = makeSut()
    propertyImageRepository.seed(
      image({ id: 'img-2', position: 1, blurhash: 'second' }),
    )
    propertyImageRepository.seed(
      image({ id: 'img-1', position: 0, blurhash: 'cover' }),
    )

    const result = await sut.execute(['listing-1'])

    expect(result.get('listing-1')).toBe('cover')
  })

  it('omits a listing id with no images at all', async () => {
    const { sut } = makeSut()

    const result = await sut.execute(['listing-1'])

    expect(result.has('listing-1')).toBe(false)
  })

  it('resolves every requested listing id independently', async () => {
    const { sut, propertyImageRepository } = makeSut()
    propertyImageRepository.seed(
      image({ id: 'img-1', propertyId: 'listing-1', blurhash: 'one' }),
    )
    propertyImageRepository.seed(
      image({ id: 'img-2', propertyId: 'listing-2', blurhash: 'two' }),
    )

    const result = await sut.execute(['listing-1', 'listing-2', 'listing-3'])

    expect(result.get('listing-1')).toBe('one')
    expect(result.get('listing-2')).toBe('two')
    expect(result.has('listing-3')).toBe(false)
  })
})
