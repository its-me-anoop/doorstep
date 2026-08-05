import { act, renderHook } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { useDeleteDraft } from '@/components/features/listings/dashboard/use-delete-draft'
import { ListingsApiError } from '@/lib/listings-client'

const deleteListingMock = vi.fn()
vi.mock('@/lib/listings-client', async () => {
  const actual = await vi.importActual<typeof import('@/lib/listings-client')>(
    '@/lib/listings-client',
  )
  return {
    ...actual,
    deleteListing: (...args: unknown[]) => deleteListingMock(...args),
  }
})

// M1-DESIGN-SPEC.md §4.3/§4.4: "Delete draft" is the one action that gets
// a confirm-before-committing pattern, inline, no modal.
describe('useDeleteDraft', () => {
  beforeEach(() => {
    deleteListingMock.mockReset()
  })

  it('starts idle', () => {
    const { result } = renderHook(() =>
      useDeleteDraft({ listingId: 'listing-1', onDeleted: vi.fn() }),
    )
    expect(result.current.phase).toBe('idle')
  })

  it('requestConfirm() moves to the confirming phase without calling the API', () => {
    const { result } = renderHook(() =>
      useDeleteDraft({ listingId: 'listing-1', onDeleted: vi.fn() }),
    )

    act(() => {
      result.current.requestConfirm()
    })

    expect(result.current.phase).toBe('confirming')
    expect(deleteListingMock).not.toHaveBeenCalled()
  })

  it('cancel() returns to idle', () => {
    const { result } = renderHook(() =>
      useDeleteDraft({ listingId: 'listing-1', onDeleted: vi.fn() }),
    )

    act(() => result.current.requestConfirm())
    act(() => result.current.cancel())

    expect(result.current.phase).toBe('idle')
  })

  it('confirmDelete() calls DELETE and, on success, tells the caller which id was removed', async () => {
    deleteListingMock.mockResolvedValue(undefined)
    const onDeleted = vi.fn()
    const { result } = renderHook(() =>
      useDeleteDraft({ listingId: 'listing-1', onDeleted }),
    )
    act(() => result.current.requestConfirm())

    await act(async () => {
      await result.current.confirmDelete()
    })

    expect(deleteListingMock).toHaveBeenCalledWith('listing-1')
    expect(onDeleted).toHaveBeenCalledWith('listing-1')
  })

  it('confirmDelete() surfaces a retryable error on failure, without calling onDeleted', async () => {
    deleteListingMock.mockRejectedValue(
      new ListingsApiError('internal_error', "Couldn't delete."),
    )
    const onDeleted = vi.fn()
    const { result } = renderHook(() =>
      useDeleteDraft({ listingId: 'listing-1', onDeleted }),
    )
    act(() => result.current.requestConfirm())

    await act(async () => {
      await result.current.confirmDelete()
    })

    expect(result.current.phase).toBe('error')
    expect(result.current.errorMessage).toBe("Couldn't delete.")
    expect(onDeleted).not.toHaveBeenCalled()
  })
})
