import { describe, expect, it, vi } from 'vitest'

// `vi.mock` factories are hoisted above every other top-level statement,
// so `MapMock` has to be declared through `vi.hoisted` rather than a
// plain `const` — a plain one would still be in its temporal dead zone
// when the (hoisted) factory below runs.
const { MapMock, setWorkerUrlMock } = vi.hoisted(() => ({
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
  setWorkerUrlMock: vi.fn(),
}))

vi.mock('maplibre-gl', () => ({
  Map: MapMock,
  Marker: vi.fn(),
  NavigationControl: vi.fn(),
  AttributionControl: vi.fn(),
  setWorkerUrl: setWorkerUrlMock,
}))
vi.mock('maplibre-gl/dist/maplibre-gl.css', () => ({}))

import {
  createMapLibreAdapter,
  MAPLIBRE_WORKER_URL,
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

  // Regression coverage for the two-part production bundling bug this
  // module's own doc comment explains in full: (1) MapLibre GL JS v6's
  // internal `getWorkerUrl()` falls back to `new Worker('')` under this
  // project's Turbopack production build, which fails silently (no
  // `map.on('error')` fires); (2) even a Turbopack-asset-copied worker
  // URL isn't enough on its own, because the worker script's *own*
  // relative import of `maplibre-gl-shared.mjs` doesn't get asset-copied
  // alongside it. `setWorkerUrl(MAPLIBRE_WORKER_URL)` — a stable
  // `public/vendor/maplibre-gl/` path where `scripts/
  // vendor-maplibre-worker.ts` has placed both files side by side — is
  // what actually fixes both, confirmed against a real `next build &&
  // next start` run in a real Chromium browser (real pins render; see
  // this suite's sibling e2e coverage, tests/e2e/m3.parity.spec.ts).
  it('points MapLibre at the vendored worker script before any map is constructed (production bundler worker-URL fix)', () => {
    // Cleared locally (rather than relying on suite-wide isolation) so
    // this assertion's call count is independent of whichever other
    // `it()` in this file happened to run first — this file has no
    // shared `beforeEach(() => vi.clearAllMocks())`.
    setWorkerUrlMock.mockClear()
    createMapLibreAdapter()

    expect(setWorkerUrlMock).toHaveBeenCalledExactlyOnceWith(
      MAPLIBRE_WORKER_URL,
    )
    // The exact failure mode being guarded against: MapLibre's own
    // fallback returns `''`, and `new Worker('')` is what actually
    // executes when nothing overrides it — pinning the literal exported
    // constant (rather than just "some non-empty string") also catches a
    // future edit that points this at a Turbopack-hashed asset reference
    // again, which this file's own header comment explains doesn't
    // actually work end to end.
    expect(MAPLIBRE_WORKER_URL).toBe(
      '/vendor/maplibre-gl/maplibre-gl-worker.mjs',
    )
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
