import { describe, expect, it, vi } from 'vitest'

// `vi.mock` factories are hoisted above every other top-level statement,
// so `MapMock` has to be declared through `vi.hoisted` rather than a
// plain `const` — a plain one would still be in its temporal dead zone
// when the (hoisted) factory below runs.
const { MapMock } = vi.hoisted(() => ({
  // A `function`, not an arrow, so `new gl.Map(...)` (gl-map-adapter.ts)
  // can actually construct it.
  MapMock: vi.fn().mockImplementation(function fakeMap() {
    return {
      on: vi.fn(),
      addControl: vi.fn(),
      addSource: vi.fn(),
      getSource: vi.fn(),
      querySourceFeatures: vi.fn(() => []),
      getBounds: vi.fn(),
      getCanvas: vi.fn(() => document.createElement('canvas')),
      flyTo: vi.fn(),
      jumpTo: vi.fn(),
      remove: vi.fn(),
    }
  }),
}))

vi.mock('maplibre-gl', () => ({
  Map: MapMock,
  Marker: vi.fn(),
  NavigationControl: vi.fn(),
  AttributionControl: vi.fn(),
}))
vi.mock('maplibre-gl/dist/maplibre-gl.css', () => ({}))

import {
  createMapLibreAdapter,
  OPENFREEMAP_LIBERTY_STYLE_URL,
} from '@/components/features/search/map/maplibre-adapter'

// PRD §15's stated fallback: MapLibre + OpenFreeMap, the default
// provider behind the `MapAdapter` seam. "Constructible with a mocked
// lib" is the seam's own contract — the real WebGL library is never
// loaded in tests.
describe('createMapLibreAdapter', () => {
  it('is constructible against a mocked maplibre-gl module', () => {
    expect(() => createMapLibreAdapter()).not.toThrow()
  })

  it('initialises against the OpenFreeMap liberty style by default (M3-DESIGN-SPEC.md §1.1)', () => {
    const adapter = createMapLibreAdapter()
    adapter.init(document.createElement('div'), {
      center: [-0.98, 51.45],
      zoom: 12,
    })
    expect(MapMock).toHaveBeenCalledWith(
      expect.objectContaining({
        style: OPENFREEMAP_LIBERTY_STYLE_URL,
        center: [-0.98, 51.45],
        zoom: 12,
      }),
    )
  })
})
