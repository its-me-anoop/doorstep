import { act, renderHook } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { useStatusTransition } from '@/components/features/listings/dashboard/use-status-transition'
import { ListingsApiError } from '@/lib/listings-client'
import type { Listing } from '@/ports/listing-repository'

const changeListingStatusMock = vi.fn()
vi.mock('@/lib/listings-client', async () => {
  const actual = await vi.importActual<typeof import('@/lib/listings-client')>(
    '@/lib/listings-client',
  )
  return {
    ...actual,
    changeListingStatus: (...args: unknown[]) =>
      changeListingStatusMock(...args),
  }
})

function listing(overrides: Partial<Listing> = {}): Listing {
  return {
    id: 'listing-1',
    listerId: 'user-1',
    agencyId: null,
    channel: 'sale',
    status: 'published',
    propertyType: 'flat',
    title: 'Flat for sale',
    slug: 'flat-abc123',
    description: '',
    features: [],
    bedrooms: 2,
    bathrooms: 1,
    price: 250_000,
    priceQualifier: 'guide_price',
    tenure: 'freehold',
    deposit: null,
    furnished: null,
    availableFrom: null,
    epcRating: null,
    councilTaxBand: null,
    newHome: false,
    addressLine1: '12 Oxford Road',
    displayAddress: '12 Oxford Road, Reading',
    town: 'Reading',
    outcode: 'RG30',
    postcode: 'RG30 1AA',
    location: { lat: 51.45, lng: -0.98 },
    locationApproximate: false,
    publishedAt: new Date('2026-01-01'),
    statusChangedAt: new Date('2026-01-01'),
    rejectionReason: null,
    createdAt: new Date('2026-01-01'),
    updatedAt: new Date('2026-01-01'),
    ...overrides,
  }
}

// M1-DESIGN-SPEC.md §4.4: optimistic paint on every action, a 6s undo
// window for consequential actions with a legal inverse, a 2s
// no-undo confirmation for reversible/terminal ones, and a rollback +
// retry on failure.
describe('useStatusTransition', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    changeListingStatusMock.mockReset()
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('paints the new status optimistically, in parallel with firing the real request', () => {
    changeListingStatusMock.mockReturnValue(new Promise(() => {})) // never resolves
    const onListingChange = vi.fn()
    const { result } = renderHook(() =>
      useStatusTransition({ listing: listing(), onListingChange }),
    )

    act(() => {
      result.current.fire('hide')
    })

    expect(onListingChange).toHaveBeenCalledWith(
      expect.objectContaining({ status: 'hidden' }),
    )
    expect(changeListingStatusMock).toHaveBeenCalledWith('listing-1', 'hide')
  })

  it('shows a 6s undo strip for an action with a legal inverse (hide)', () => {
    changeListingStatusMock.mockReturnValue(new Promise(() => {}))
    const { result } = renderHook(() =>
      useStatusTransition({ listing: listing(), onListingChange: vi.fn() }),
    )

    act(() => {
      result.current.fire('hide')
    })

    expect(result.current.phase).toEqual({
      type: 'confirmed',
      message: 'Hidden from search.',
      undoAction: 'unhide',
    })

    act(() => {
      vi.advanceTimersByTime(5999)
    })
    expect(result.current.phase.type).toBe('confirmed')

    act(() => {
      vi.advanceTimersByTime(1)
    })
    expect(result.current.phase).toEqual({ type: 'idle' })
  })

  it('shows a 2s no-undo confirmation for complete — no legal inverse exists', () => {
    changeListingStatusMock.mockReturnValue(new Promise(() => {}))
    const { result } = renderHook(() =>
      useStatusTransition({
        listing: listing({ status: 'under_offer' }),
        onListingChange: vi.fn(),
      }),
    )

    act(() => {
      result.current.fire('complete')
    })

    expect(result.current.phase).toEqual({
      type: 'confirmed',
      message: 'Marked sold.',
      undoAction: null,
    })

    act(() => {
      vi.advanceTimersByTime(1999)
    })
    expect(result.current.phase.type).toBe('confirmed')

    act(() => {
      vi.advanceTimersByTime(1)
    })
    expect(result.current.phase).toEqual({ type: 'idle' })
  })

  it('clicking Undo fires the inverse action as a second real request', async () => {
    changeListingStatusMock.mockResolvedValue(listing({ status: 'hidden' }))
    const onListingChange = vi.fn()
    const { result } = renderHook(() =>
      useStatusTransition({ listing: listing(), onListingChange }),
    )

    await act(async () => {
      result.current.fire('hide')
    })
    changeListingStatusMock.mockClear()
    onListingChange.mockClear()
    changeListingStatusMock.mockReturnValue(new Promise(() => {}))

    await act(async () => {
      const undoAction = (result.current.phase as { undoAction: string })
        .undoAction
      result.current.fire(undoAction as never)
    })

    expect(changeListingStatusMock).toHaveBeenCalledWith('listing-1', 'unhide')
    expect(onListingChange).toHaveBeenCalledWith(
      expect.objectContaining({ status: 'published' }),
    )
    // unhide has no inverse of its own — 2s confirmation, no further undo.
    expect(result.current.phase).toEqual({
      type: 'confirmed',
      message: 'Unhidden.',
      undoAction: null,
    })
  })

  it('rolls back the optimistic paint and shows a retryable error when the request fails', async () => {
    changeListingStatusMock.mockRejectedValue(
      new ListingsApiError('internal_error', 'Network down.'),
    )
    const onListingChange = vi.fn()
    const original = listing()
    const { result } = renderHook(() =>
      useStatusTransition({ listing: original, onListingChange }),
    )

    await act(async () => {
      result.current.fire('hide')
      await vi.runAllTimersAsync()
    })

    expect(onListingChange).toHaveBeenLastCalledWith(original)
    expect(result.current.phase).toEqual({
      type: 'error',
      message: 'Network down.',
      failedAction: 'hide',
    })
  })

  it('retry() re-fires the action that failed', async () => {
    changeListingStatusMock.mockRejectedValueOnce(
      new ListingsApiError('internal_error', 'Network down.'),
    )
    const onListingChange = vi.fn()
    const { result } = renderHook(() =>
      useStatusTransition({ listing: listing(), onListingChange }),
    )

    await act(async () => {
      result.current.fire('hide')
      await vi.runAllTimersAsync()
    })
    expect(result.current.phase.type).toBe('error')

    changeListingStatusMock.mockReturnValue(new Promise(() => {}))
    act(() => {
      result.current.retry()
    })

    expect(changeListingStatusMock).toHaveBeenLastCalledWith(
      'listing-1',
      'hide',
    )
    expect(result.current.phase.type).toBe('confirmed')
  })

  it('reconciles with the server response on success', async () => {
    const serverListing = listing({
      status: 'hidden',
      statusChangedAt: new Date('2026-03-01'),
    })
    changeListingStatusMock.mockResolvedValue(serverListing)
    const onListingChange = vi.fn()
    const { result } = renderHook(() =>
      useStatusTransition({ listing: listing(), onListingChange }),
    )

    await act(async () => {
      result.current.fire('hide')
      await vi.runAllTimersAsync()
    })

    expect(onListingChange).toHaveBeenLastCalledWith(serverListing)
  })
})
