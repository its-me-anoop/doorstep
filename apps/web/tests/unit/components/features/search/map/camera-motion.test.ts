import { afterEach, describe, expect, it, vi } from 'vitest'

import {
  moveCamera,
  prefersReducedMotion,
  type CameraCapableMap,
} from '@/components/features/search/map/camera-motion'

function fakeMap() {
  return {
    jumpTo: vi.fn<CameraCapableMap['jumpTo']>(),
    flyTo: vi.fn<CameraCapableMap['flyTo']>(),
  } satisfies CameraCapableMap
}

// M3-DESIGN-SPEC.md §5 — MapLibre/Mapbox's own `flyTo`/`easeTo` camera
// animations are not CSS transitions, so the global
// `prefers-reduced-motion` CSS rule never touches them; this is the one
// motion primitive in the whole product that needs its own explicit JS
// check, funnelled through this one function so every camera move in the
// map view (currently just cluster-click zoom) goes through it rather
// than each call site re-deriving the branch.
describe('moveCamera', () => {
  it('jumps instantly, never animating, when reduced motion is requested', () => {
    const map = fakeMap()
    moveCamera(map, { center: [-0.98, 51.45], zoom: 14 }, true)
    expect(map.jumpTo).toHaveBeenCalledWith({
      center: [-0.98, 51.45],
      zoom: 14,
    })
    expect(map.flyTo).not.toHaveBeenCalled()
  })

  it('flies with a capped duration and an explicit JS easing function otherwise', () => {
    const map = fakeMap()
    moveCamera(map, { center: [-0.98, 51.45], zoom: 14 }, false)
    expect(map.jumpTo).not.toHaveBeenCalled()
    expect(map.flyTo).toHaveBeenCalledTimes(1)
    const call = map.flyTo.mock.calls[0][0]
    expect(call.center).toEqual([-0.98, 51.45])
    expect(call.zoom).toBe(14)
    expect(call.duration).toBe(600)
    expect(typeof call.easing).toBe('function')
  })

  it('the fly-to easing function is ease-out shaped (starts at 0, ends at 1, front-loaded)', () => {
    const map = fakeMap()
    moveCamera(map, { center: [0, 0] }, false)
    const easing = map.flyTo.mock.calls[0][0].easing as (t: number) => number
    expect(easing(0)).toBe(0)
    expect(easing(1)).toBe(1)
    // Ease-out: past the midpoint sooner than a linear curve would be.
    expect(easing(0.5)).toBeGreaterThan(0.5)
  })
})

describe('prefersReducedMotion', () => {
  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('reflects window.matchMedia(reduce).matches', () => {
    vi.stubGlobal('matchMedia', (query: string) => ({
      matches: query === '(prefers-reduced-motion: reduce)',
    }))
    expect(prefersReducedMotion()).toBe(true)
  })

  it('is false when the media query does not match', () => {
    vi.stubGlobal('matchMedia', () => ({ matches: false }))
    expect(prefersReducedMotion()).toBe(false)
  })

  it('is false (never throws) when matchMedia is unavailable', () => {
    vi.stubGlobal('matchMedia', undefined)
    expect(prefersReducedMotion()).toBe(false)
  })
})
