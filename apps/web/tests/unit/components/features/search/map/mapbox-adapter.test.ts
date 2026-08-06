import { describe, expect, it, vi } from 'vitest'

// See maplibre-adapter.test.ts's own comment: `vi.mock` factories are
// hoisted above plain top-level `const`s, so these have to go through
// `vi.hoisted`.
const { MapMock, mapboxglMock } = vi.hoisted(() => {
  // A `function`, not an arrow, so `new gl.Map(...)` (gl-map-adapter.ts)
  // can actually construct it.
  const MapMock = vi.fn().mockImplementation(function fakeMap() {
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
  })
  const mapboxglMock = {
    Map: MapMock,
    Marker: vi.fn(),
    NavigationControl: vi.fn(),
    AttributionControl: vi.fn(),
    accessToken: '',
  }
  return { MapMock, mapboxglMock }
})

vi.mock('mapbox-gl', () => ({ default: mapboxglMock }))
vi.mock('mapbox-gl/dist/mapbox-gl.css', () => ({}))

import { createMapboxAdapter } from '@/components/features/search/map/mapbox-adapter'

// The env-gated provider (M3-DESIGN-SPEC.md §0): code-complete, unit-
// tested via this mocked-lib seam, deliberately not integration-tested
// (no token is provisioned anywhere in this project yet — see this
// module's own doc comment).
describe('createMapboxAdapter', () => {
  it('is constructible against a mocked mapbox-gl module', () => {
    expect(() => createMapboxAdapter('pk.test-token')).not.toThrow()
  })

  it('sets mapboxgl.accessToken from the given token', () => {
    createMapboxAdapter('pk.another-token')
    expect(mapboxglMock.accessToken).toBe('pk.another-token')
  })

  it('initialises against the Mapbox light style', () => {
    const adapter = createMapboxAdapter('pk.test-token')
    adapter.init(document.createElement('div'), {
      center: [-0.98, 51.45],
      zoom: 12,
    })
    expect(MapMock).toHaveBeenCalledWith(
      expect.objectContaining({ style: 'mapbox://styles/mapbox/light-v11' }),
    )
  })
})
