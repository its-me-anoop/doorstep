import { act, renderHook } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { useSearchAsYouMove } from '@/components/features/search/map/use-search-as-you-move'

const bboxA = { neLat: 51.5, neLng: -0.9, swLat: 51.4, swLng: -1.0 }
const bboxB = { neLat: 51.6, neLng: -0.8, swLat: 51.5, swLng: -0.9 }

// M3-DESIGN-SPEC.md §1.5 — the search-as-I-move state machine. Default
// off; while off, a moveend surfaces a "Search this area" button rather
// than requerying; while on, every moveend debounces 400ms then
// requeries automatically with no button ever shown; ticking the
// checkbox while a move is already pending fires it immediately, once,
// and arms auto mode going forward.
describe('useSearchAsYouMove', () => {
  beforeEach(() => {
    vi.useFakeTimers()
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('starts disabled with no pending "Search this area" button', () => {
    const onRequery = vi.fn()
    const { result } = renderHook(() => useSearchAsYouMove({ onRequery }))
    expect(result.current.enabled).toBe(false)
    expect(result.current.showSearchThisArea).toBe(false)
  })

  describe('while off (default)', () => {
    it('a moveend surfaces the button without requerying', () => {
      const onRequery = vi.fn()
      const { result } = renderHook(() => useSearchAsYouMove({ onRequery }))

      act(() => result.current.notifyMoveEnd(bboxA))

      expect(result.current.showSearchThisArea).toBe(true)
      expect(onRequery).not.toHaveBeenCalled()
    })

    it('clicking "Search this area" requeries once with the pending bbox and hides the button', () => {
      const onRequery = vi.fn()
      const { result } = renderHook(() => useSearchAsYouMove({ onRequery }))

      act(() => result.current.notifyMoveEnd(bboxA))
      act(() => result.current.searchThisArea())

      expect(onRequery).toHaveBeenCalledTimes(1)
      expect(onRequery).toHaveBeenCalledWith(bboxA)
      expect(result.current.showSearchThisArea).toBe(false)
    })

    it('calling searchThisArea with nothing pending is a no-op', () => {
      const onRequery = vi.fn()
      const { result } = renderHook(() => useSearchAsYouMove({ onRequery }))
      act(() => result.current.searchThisArea())
      expect(onRequery).not.toHaveBeenCalled()
    })
  })

  describe('while on', () => {
    it('debounces 400ms after moveend then requeries automatically, without ever showing the button', () => {
      const onRequery = vi.fn()
      const { result } = renderHook(() => useSearchAsYouMove({ onRequery }))

      act(() => result.current.toggleEnabled())
      act(() => result.current.notifyMoveEnd(bboxA))

      expect(result.current.showSearchThisArea).toBe(false)
      expect(onRequery).not.toHaveBeenCalled()

      act(() => vi.advanceTimersByTime(399))
      expect(onRequery).not.toHaveBeenCalled()

      act(() => vi.advanceTimersByTime(1))
      expect(onRequery).toHaveBeenCalledTimes(1)
      expect(onRequery).toHaveBeenCalledWith(bboxA)
      expect(result.current.showSearchThisArea).toBe(false)
    })

    it('resets the debounce on rapid successive moves, firing once with only the latest bbox', () => {
      const onRequery = vi.fn()
      const { result } = renderHook(() => useSearchAsYouMove({ onRequery }))
      act(() => result.current.toggleEnabled())

      act(() => result.current.notifyMoveEnd(bboxA))
      act(() => vi.advanceTimersByTime(200))
      act(() => result.current.notifyMoveEnd(bboxB))
      act(() => vi.advanceTimersByTime(399))
      expect(onRequery).not.toHaveBeenCalled()

      act(() => vi.advanceTimersByTime(1))
      expect(onRequery).toHaveBeenCalledTimes(1)
      expect(onRequery).toHaveBeenCalledWith(bboxB)
    })
  })

  describe('turning on with a move already pending', () => {
    it('fires the pending requery immediately, once, and arms auto mode going forward', () => {
      const onRequery = vi.fn()
      const { result } = renderHook(() => useSearchAsYouMove({ onRequery }))

      act(() => result.current.notifyMoveEnd(bboxA))
      act(() => result.current.toggleEnabled())

      expect(onRequery).toHaveBeenCalledTimes(1)
      expect(onRequery).toHaveBeenCalledWith(bboxA)
      expect(result.current.enabled).toBe(true)
      expect(result.current.showSearchThisArea).toBe(false)

      // Auto mode is now armed — the next move debounces and requeries
      // without a second manual click.
      act(() => result.current.notifyMoveEnd(bboxB))
      act(() => vi.advanceTimersByTime(400))
      expect(onRequery).toHaveBeenCalledTimes(2)
      expect(onRequery).toHaveBeenLastCalledWith(bboxB)
    })

    it('does not requery immediately when there is nothing pending', () => {
      const onRequery = vi.fn()
      const { result } = renderHook(() => useSearchAsYouMove({ onRequery }))
      act(() => result.current.toggleEnabled())
      expect(onRequery).not.toHaveBeenCalled()
      expect(result.current.enabled).toBe(true)
    })
  })

  it('turning off cancels a queued auto-requery without firing it, and the button reappears for the un-queried move', () => {
    const onRequery = vi.fn()
    const { result } = renderHook(() => useSearchAsYouMove({ onRequery }))

    act(() => result.current.toggleEnabled())
    act(() => result.current.notifyMoveEnd(bboxA))
    act(() => result.current.toggleEnabled())

    act(() => vi.advanceTimersByTime(1000))
    expect(onRequery).not.toHaveBeenCalled()
    expect(result.current.enabled).toBe(false)
    expect(result.current.showSearchThisArea).toBe(true)
  })
})
