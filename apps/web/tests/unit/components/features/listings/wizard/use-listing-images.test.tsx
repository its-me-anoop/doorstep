import { act, renderHook, waitFor } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'

const listListingImagesMock = vi.fn()
vi.mock('@/lib/images-client', () => ({
  listListingImages: (...args: unknown[]) => listListingImagesMock(...args),
}))

import { useListingImages } from '@/components/features/listings/wizard/use-listing-images'
import type { ListingImage } from '@/lib/images-client'

function image(overrides: Partial<ListingImage> = {}): ListingImage {
  return {
    id: 'img-1',
    propertyId: 'listing-1',
    kind: 'photo',
    position: 0,
    width: 400,
    height: 300,
    blurhash: 'LGF5?xYk^6#M@-5c,1J5@[or[Q6.',
    altText: null,
    urls: [],
    ...overrides,
  }
}

// M1-DESIGN-SPEC.md §3.5 — the wizard's photo step reloading a draft's
// already-processed images on mount, plus the three primitive local
// mutations the upload/reorder/delete flows apply after each API call.
describe('useListingImages', () => {
  afterEach(() => {
    vi.clearAllMocks()
  })

  it('loads images for the listing on mount', async () => {
    listListingImagesMock.mockResolvedValue([image({ id: 'img-1' })])
    const { result } = renderHook(() => useListingImages('listing-1'))

    expect(result.current.status).toBe('loading')
    await waitFor(() => expect(result.current.status).toBe('ready'))

    expect(listListingImagesMock).toHaveBeenCalledWith('listing-1')
    expect(result.current.images).toEqual([image({ id: 'img-1' })])
  })

  it('surfaces an error status when the load fails, without throwing', async () => {
    listListingImagesMock.mockRejectedValue(new Error('network down'))
    const { result } = renderHook(() => useListingImages('listing-1'))

    await waitFor(() => expect(result.current.status).toBe('error'))
    expect(result.current.images).toEqual([])
  })

  it('onImageAdded appends a new image', async () => {
    listListingImagesMock.mockResolvedValue([])
    const { result } = renderHook(() => useListingImages('listing-1'))
    await waitFor(() => expect(result.current.status).toBe('ready'))

    act(() => result.current.onImageAdded(image({ id: 'img-new' })))

    expect(result.current.images).toEqual([image({ id: 'img-new' })])
  })

  it('onImagesReplaced updates matching images by id and leaves the rest untouched', async () => {
    listListingImagesMock.mockResolvedValue([
      image({ id: 'img-1', position: 0 }),
      image({ id: 'img-2', position: 1 }),
      image({ id: 'img-3', position: 2 }),
    ])
    const { result } = renderHook(() => useListingImages('listing-1'))
    await waitFor(() => expect(result.current.status).toBe('ready'))

    act(() =>
      result.current.onImagesReplaced([
        image({ id: 'img-1', position: 2 }),
        image({ id: 'img-3', position: 0 }),
      ]),
    )

    expect(result.current.images.map((i) => [i.id, i.position])).toEqual([
      ['img-1', 2],
      ['img-2', 1],
      ['img-3', 0],
    ])
  })

  it('onImageRemoved drops the image by id', async () => {
    listListingImagesMock.mockResolvedValue([
      image({ id: 'img-1' }),
      image({ id: 'img-2' }),
    ])
    const { result } = renderHook(() => useListingImages('listing-1'))
    await waitFor(() => expect(result.current.status).toBe('ready'))

    act(() => result.current.onImageRemoved('img-1'))

    expect(result.current.images.map((i) => i.id)).toEqual(['img-2'])
  })
})
