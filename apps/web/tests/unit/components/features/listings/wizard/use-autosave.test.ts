import { act, renderHook } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { useAutosave } from '@/components/features/listings/wizard/use-autosave'

// M1-DESIGN-SPEC.md §3.0: "autosave fires on field blur, on step change
// ..., and after 3 seconds of typing inactivity — whichever comes
// first." saveNow() covers blur/step-change; the idle timer covers the
// third trigger.
describe('useAutosave', () => {
  beforeEach(() => {
    vi.useFakeTimers()
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('does not save before the 3s idle window elapses', () => {
    const onSave = vi.fn().mockResolvedValue(undefined)
    renderHook(() => useAutosave({ values: { a: 1 }, onSave }))

    act(() => {
      vi.advanceTimersByTime(2999)
    })
    expect(onSave).not.toHaveBeenCalled()
  })

  it('saves the current value snapshot after 3s of inactivity', async () => {
    const onSave = vi.fn().mockResolvedValue(undefined)
    renderHook(() => useAutosave({ values: { price: 250_000 }, onSave }))

    await act(async () => {
      vi.advanceTimersByTime(3000)
    })
    expect(onSave).toHaveBeenCalledWith({ price: 250_000 })
  })

  it('resets the idle timer on every value change (typing keeps postponing the save)', () => {
    const onSave = vi.fn().mockResolvedValue(undefined)
    const { rerender } = renderHook(
      ({ values }) => useAutosave({ values, onSave }),
      { initialProps: { values: { price: 1 } } },
    )

    act(() => {
      vi.advanceTimersByTime(2000)
    })
    rerender({ values: { price: 12 } })
    act(() => {
      vi.advanceTimersByTime(2000)
    })
    expect(onSave).not.toHaveBeenCalled()

    act(() => {
      vi.advanceTimersByTime(1000)
    })
    expect(onSave).toHaveBeenCalledTimes(1)
    expect(onSave).toHaveBeenCalledWith({ price: 12 })
  })

  it('saveNow() saves immediately, without waiting for the idle timer (blur / step-change trigger)', async () => {
    const onSave = vi.fn().mockResolvedValue(undefined)
    const { result } = renderHook(() =>
      useAutosave({ values: { addressLine1: '12 Oxford Road' }, onSave }),
    )

    await act(async () => {
      result.current.saveNow()
    })
    expect(onSave).toHaveBeenCalledWith({ addressLine1: '12 Oxford Road' })
  })

  it('does not re-save an unchanged snapshot', async () => {
    const onSave = vi.fn().mockResolvedValue(undefined)
    const { result } = renderHook(() =>
      useAutosave({ values: { town: 'Reading' }, onSave }),
    )

    await act(async () => {
      result.current.saveNow()
    })
    await act(async () => {
      result.current.saveNow()
    })
    expect(onSave).toHaveBeenCalledTimes(1)
  })

  it('tracks status through saving -> saved, and records lastSavedAt', async () => {
    const onSave = vi.fn().mockResolvedValue(undefined)
    const { result } = renderHook(() =>
      useAutosave({ values: { town: 'Reading' }, onSave }),
    )

    expect(result.current.status).toBe('idle')
    await act(async () => {
      result.current.saveNow()
    })
    expect(result.current.status).toBe('saved')
    expect(result.current.lastSavedAt).toBeInstanceOf(Date)
  })

  it('surfaces an error status when the save rejects, without throwing', async () => {
    const onSave = vi.fn().mockRejectedValue(new Error('network down'))
    const { result } = renderHook(() =>
      useAutosave({ values: { town: 'Reading' }, onSave }),
    )

    await act(async () => {
      result.current.saveNow()
    })
    expect(result.current.status).toBe('error')
  })
})
