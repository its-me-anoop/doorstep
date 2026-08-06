import { describe, expect, it, vi } from 'vitest'

const revalidatePathMock = vi.fn()
vi.mock('next/cache', () => ({
  revalidatePath: (path: string) => revalidatePathMock(path),
}))

import { revalidateListingPaths } from '@/lib/listing-revalidation'

// PRD §8.3: "Listing detail | ISR with on-demand revalidation triggered
// by publish, edit and status changes." This is the mechanism: called
// from the mutation API routes (status, PATCH) after a successful write.
describe('revalidateListingPaths', () => {
  it('always revalidates the listing detail page', () => {
    revalidatePathMock.mockClear()
    revalidateListingPaths({
      slug: 'a-slug',
      channel: 'sale',
      town: 'Nowhere',
      outcode: 'XX1',
    })

    expect(revalidatePathMock).toHaveBeenCalledWith('/property/a-slug')
  })

  it('also revalidates the matching curated area landing page', () => {
    revalidatePathMock.mockClear()
    revalidateListingPaths({
      slug: 'a-slug',
      channel: 'sale',
      town: 'Reading',
      outcode: 'RG1',
    })

    expect(revalidatePathMock).toHaveBeenCalledWith('/for-sale/reading')
  })

  it('uses the /to-rent prefix for a rent listing', () => {
    revalidatePathMock.mockClear()
    revalidateListingPaths({
      slug: 'a-slug',
      channel: 'rent',
      town: 'Wokingham',
      outcode: 'RG41',
    })

    expect(revalidatePathMock).toHaveBeenCalledWith('/to-rent/wokingham')
  })

  it('revalidates every matching area when more than one applies (the documented Caversham/Emmer Green RG4 overlap)', () => {
    revalidatePathMock.mockClear()
    revalidateListingPaths({
      slug: 'a-slug',
      channel: 'sale',
      town: 'Caversham',
      outcode: 'RG4',
    })

    const paths = revalidatePathMock.mock.calls.map((call) => call[0])
    expect(paths).toContain('/for-sale/caversham')
    expect(paths).toContain('/for-sale/emmer-green')
  })

  it('revalidates only the detail page for a town/outcode outside the curated set', () => {
    revalidatePathMock.mockClear()
    revalidateListingPaths({
      slug: 'a-slug',
      channel: 'sale',
      town: 'Henley-on-Thames',
      outcode: 'RG9',
    })

    expect(revalidatePathMock).toHaveBeenCalledTimes(1)
    expect(revalidatePathMock).toHaveBeenCalledWith('/property/a-slug')
  })
})
