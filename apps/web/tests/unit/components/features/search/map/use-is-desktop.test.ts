import { act, renderHook } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'

import { useIsDesktop } from '@/components/features/search/map/use-is-desktop'

function stubMatchMedia(initialMatches: boolean) {
  let changeHandler: ((event: { matches: boolean }) => void) | null = null
  const mql = {
    matches: initialMatches,
    addEventListener: vi.fn((_event: string, handler: typeof changeHandler) => {
      changeHandler = handler
    }),
    removeEventListener: vi.fn(),
  }
  vi.stubGlobal('matchMedia', () => mql)
  return {
    change(matches: boolean) {
      mql.matches = matches
      changeHandler?.({ matches })
    },
  }
}

// The one JS breakpoint check in the map view (map-view.tsx's own doc
// comment: the mini card's mechanism, not its layout, differs by
// breakpoint) — mirrors the `lg:` Tailwind breakpoint (1024px) used
// everywhere else in the split-view/full-screen CSS.
describe('useIsDesktop', () => {
  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('reflects the current match on mount', () => {
    stubMatchMedia(true)
    const { result } = renderHook(() => useIsDesktop())
    expect(result.current).toBe(true)
  })

  it('updates when the media query match changes (e.g. window resize)', () => {
    const media = stubMatchMedia(false)
    const { result } = renderHook(() => useIsDesktop())
    expect(result.current).toBe(false)

    act(() => media.change(true))
    expect(result.current).toBe(true)
  })
})
