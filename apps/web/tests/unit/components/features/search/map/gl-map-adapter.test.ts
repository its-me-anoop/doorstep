import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import {
  createGlMapAdapter,
  type GlLibrary,
} from '@/components/features/search/map/gl-map-adapter'
import type { MapPinFeatureCollection } from '@/components/features/search/map/geojson'

type Handler = (event: unknown) => void

class FakeSource {
  data: MapPinFeatureCollection
  clusterExpansionZoom = new Map<number, number>()

  constructor(data: MapPinFeatureCollection) {
    this.data = data
  }

  setData = vi.fn((data: MapPinFeatureCollection) => {
    this.data = data
  })

  getClusterExpansionZoom = vi.fn((clusterId: number) => {
    const zoom = this.clusterExpansionZoom.get(clusterId)
    return zoom === undefined
      ? Promise.reject(new Error('no expansion zoom configured'))
      : Promise.resolve(zoom)
  })
}

class FakeMap {
  static lastInstance: FakeMap | null = null

  options: Record<string, unknown>
  listeners = new Map<string, Set<Handler>>()
  sources = new Map<
    string,
    { config: Record<string, unknown>; source: FakeSource }
  >()
  controls: Array<{ control: unknown; position?: string }> = []
  queryFeaturesResult: GeoJSON.Feature[] = []
  boundsResult = {
    getNorth: () => 51.5,
    getEast: () => -0.9,
    getSouth: () => 51.4,
    getWest: () => -1.0,
  }
  canvas = document.createElement('canvas')
  flyTo = vi.fn()
  jumpTo = vi.fn()
  remove = vi.fn()

  constructor(options: Record<string, unknown>) {
    this.options = options
    FakeMap.lastInstance = this
  }

  on(event: string, handler: Handler) {
    if (!this.listeners.has(event)) this.listeners.set(event, new Set())
    this.listeners.get(event)?.add(handler)
  }

  emit(event: string, payload?: unknown) {
    for (const handler of this.listeners.get(event) ?? []) handler(payload)
  }

  addControl(control: unknown, position?: string) {
    this.controls.push({ control, position })
  }

  addSource(id: string, config: Record<string, unknown>) {
    this.sources.set(id, {
      config,
      source: new FakeSource(config.data as MapPinFeatureCollection),
    })
  }

  getSource(id: string) {
    return this.sources.get(id)?.source
  }

  querySourceFeatures() {
    return this.queryFeaturesResult
  }

  getBounds() {
    return this.boundsResult
  }

  getCanvas() {
    return this.canvas
  }
}

class FakeMarker {
  static instances: FakeMarker[] = []

  element: HTMLElement
  anchor?: string
  lngLat: [number, number] | null = null
  addTo = vi.fn(() => this)
  remove = vi.fn()

  constructor(options: { element: HTMLElement; anchor?: string }) {
    this.element = options.element
    this.anchor = options.anchor
    FakeMarker.instances.push(this)
  }

  setLngLat(lngLat: [number, number]) {
    this.lngLat = lngLat
    return this
  }
}

class FakePopup {
  static instances: FakePopup[] = []

  options: Record<string, unknown>
  lngLat: [number, number] | null = null
  domContent: HTMLElement | null = null
  addTo = vi.fn(() => this)
  remove = vi.fn()

  constructor(options: Record<string, unknown>) {
    this.options = options
    FakePopup.instances.push(this)
  }

  setLngLat(lngLat: [number, number]) {
    this.lngLat = lngLat
    return this
  }

  setDOMContent(node: HTMLElement) {
    this.domContent = node
    return this
  }
}

function fakeGlLibrary(): GlLibrary {
  return {
    Map: FakeMap as unknown as GlLibrary['Map'],
    Marker: FakeMarker as unknown as GlLibrary['Marker'],
    Popup: FakePopup as unknown as GlLibrary['Popup'],
    NavigationControl: class {},
    AttributionControl: class {},
  }
}

function pointFeature(
  hitId: string,
  label: string,
  underOffer: boolean,
  coords: [number, number],
): GeoJSON.Feature {
  return {
    type: 'Feature',
    geometry: { type: 'Point', coordinates: coords },
    properties: { hitId, label, underOffer },
  }
}

function clusterFeature(
  clusterId: number,
  count: number,
  coords: [number, number],
): GeoJSON.Feature {
  return {
    type: 'Feature',
    geometry: { type: 'Point', coordinates: coords },
    properties: { cluster: true, cluster_id: clusterId, point_count: count },
  }
}

// The adapter's own orchestration logic (marker sync, cluster-click
// expansion zoom, user-vs-programmatic moveend filtering, tile-vs-data
// error routing) — the map library itself is mocked entirely, per the
// M3 task's own test strategy ("the seam makes this tractable — design
// for it").
describe('createGlMapAdapter', () => {
  let container: HTMLDivElement

  beforeEach(() => {
    FakeMarker.instances = []
    FakePopup.instances = []
    container = document.createElement('div')
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  function init(gl: GlLibrary) {
    const adapter = createGlMapAdapter(gl, 'https://example.com/style.json')
    adapter.init(container, { center: [-0.9788, 51.454], zoom: 13 })
    const map = FakeMap.lastInstance as FakeMap
    return { adapter, map }
  }

  it('constructs the underlying map with the given container/style/center/zoom, and tags the container for the CSS tint filter', () => {
    const gl = fakeGlLibrary()
    const { map } = init(gl)
    expect(map.options.style).toBe('https://example.com/style.json')
    expect(map.options.center).toEqual([-0.9788, 51.454])
    expect(map.options.zoom).toBe(13)
    expect(container.classList.contains('map-canvas-container')).toBe(true)
  })

  it('adds a zoom control (bottom-right) and an attribution control (bottom-left)', () => {
    const { map } = init(fakeGlLibrary())
    expect(map.controls).toHaveLength(2)
    expect(map.controls[0].position).toBe('bottom-right')
    expect(map.controls[1].position).toBe('bottom-left')
  })

  it('marks the canvas aria-hidden (§4/§6), not the whole container', () => {
    const { map } = init(fakeGlLibrary())
    expect(map.canvas.getAttribute('aria-hidden')).toBe('true')
    expect(container.getAttribute('aria-hidden')).not.toBe('true')
  })

  // WCAG 4.1.2 (found by tests/e2e/m3.parity.spec.ts's real-pin axe scan
  // against a real MapLibre instance, not this fake): both MapLibre and
  // Mapbox GL give their own canvas `tabindex="0"` by default so it's
  // independently keyboard-pannable — content that stays in the tab
  // order while its aria-hidden ancestor-or-self hides it from the
  // accessibility tree is exactly the "aria-hidden-focus" violation axe
  // flags. Pins/clusters already strip their own tabindex for the same
  // reason (pin-marker.ts/cluster-marker.ts's `tabIndex = -1`); the base
  // canvas needs the identical treatment, which the fake canvas's own
  // (library-default-free) starting state doesn't surface on its own —
  // asserted directly here instead.
  it('also removes the canvas from tab order — an aria-hidden element must never stay focusable (WCAG 4.1.2)', () => {
    const { map } = init(fakeGlLibrary())
    expect(map.canvas.getAttribute('tabindex')).toBe('-1')
  })

  it('adds the clustered hits source once the map loads', () => {
    const { map } = init(fakeGlLibrary())
    map.emit('load')
    const source = map.sources.get('hits')
    expect(source?.config.cluster).toBe(true)
    expect(typeof source?.config.clusterRadius).toBe('number')
  })

  it('queues setData before load and applies it once the source exists', () => {
    const { adapter, map } = init(fakeGlLibrary())
    const fc: MapPinFeatureCollection = {
      type: 'FeatureCollection',
      features: [
        {
          type: 'Feature',
          geometry: { type: 'Point', coordinates: [-0.98, 51.45] },
          properties: { hitId: 'pr_1', label: '£350k', underOffer: false },
        },
      ],
    }
    adapter.setData(fc)
    map.emit('load')
    expect(map.sources.get('hits')?.source.data).toEqual(fc)
  })

  it('applies setData directly to the live source once already loaded', () => {
    const { adapter, map } = init(fakeGlLibrary())
    map.emit('load')
    const fc: MapPinFeatureCollection = {
      type: 'FeatureCollection',
      features: [],
    }
    adapter.setData(fc)
    expect(map.sources.get('hits')?.source.setData).toHaveBeenCalledWith(fc)
  })

  it('renders a pin marker for a non-cluster feature and fires "select" with its hitId on click', () => {
    const { adapter, map } = init(fakeGlLibrary())
    map.emit('load')
    map.queryFeaturesResult = [
      pointFeature('pr_1', '£350k', false, [-0.98, 51.45]),
    ]
    map.emit('moveend', {})

    expect(FakeMarker.instances).toHaveLength(1)
    expect(FakeMarker.instances[0].anchor).toBe('bottom')
    expect(FakeMarker.instances[0].lngLat).toEqual([-0.98, 51.45])
    const pinEl = FakeMarker.instances[0].element.querySelector('.pin')
    expect(pinEl?.textContent).toBe('£350k')

    const onSelect = vi.fn()
    const unsubscribe = adapter.on('select', onSelect)
    pinEl?.dispatchEvent(new MouseEvent('click', { bubbles: true }))
    expect(onSelect).toHaveBeenCalledWith('pr_1')

    unsubscribe()
    pinEl?.dispatchEvent(new MouseEvent('click', { bubbles: true }))
    expect(onSelect).toHaveBeenCalledTimes(1)
  })

  it('removes a marker once its feature is no longer returned by querySourceFeatures', () => {
    const { map } = init(fakeGlLibrary())
    map.emit('load')
    map.queryFeaturesResult = [
      pointFeature('pr_1', '£350k', false, [-0.98, 51.45]),
    ]
    map.emit('moveend', {})
    expect(FakeMarker.instances).toHaveLength(1)

    map.queryFeaturesResult = []
    map.emit('moveend', {})
    expect(FakeMarker.instances[0].remove).toHaveBeenCalledTimes(1)
  })

  it('renders a cluster marker and, on click, zooms to its expansion zoom via flyTo (reduced motion off)', async () => {
    const { map } = init(fakeGlLibrary())
    map.emit('load')
    const source = map.sources.get('hits')?.source as FakeSource
    source.clusterExpansionZoom.set(42, 15)

    map.queryFeaturesResult = [clusterFeature(42, 12, [-0.98, 51.45])]
    map.emit('moveend', {})

    const clusterEl = FakeMarker.instances[0].element.querySelector('.cluster')
    expect(clusterEl?.textContent).toBe('12')

    clusterEl?.dispatchEvent(new MouseEvent('click', { bubbles: true }))
    await vi.waitFor(() => expect(map.flyTo).toHaveBeenCalledTimes(1))
    expect(map.flyTo).toHaveBeenCalledWith(
      expect.objectContaining({ center: [-0.98, 51.45], zoom: 15 }),
    )
  })

  it('fires "moveend" with the viewport bounds only for a user-initiated move (originalEvent present)', () => {
    const { adapter, map } = init(fakeGlLibrary())
    const onMoveEnd = vi.fn()
    adapter.on('moveend', onMoveEnd)

    map.emit('moveend', {})
    expect(onMoveEnd).not.toHaveBeenCalled()

    map.emit('moveend', { originalEvent: new Event('mousedown') })
    expect(onMoveEnd).toHaveBeenCalledWith({
      neLat: 51.5,
      neLng: -0.9,
      swLat: 51.4,
      swLng: -1.0,
    })
  })

  it('fires "tilesFailed" for a general map error, but not for an error on the hits source itself', () => {
    const { adapter, map } = init(fakeGlLibrary())
    const onTilesFailed = vi.fn()
    adapter.on('tilesFailed', onTilesFailed)

    map.emit('error', { sourceId: 'hits' })
    expect(onTilesFailed).not.toHaveBeenCalled()

    map.emit('error', {})
    expect(onTilesFailed).toHaveBeenCalledTimes(1)
  })

  it('setHighlightedHit toggles pin--active on the targeted pin only', () => {
    const { adapter, map } = init(fakeGlLibrary())
    map.emit('load')
    map.queryFeaturesResult = [
      pointFeature('pr_1', '£350k', false, [-0.98, 51.45]),
      pointFeature('pr_2', '£400k', false, [-0.97, 51.46]),
    ]
    map.emit('moveend', {})

    adapter.setHighlightedHit('pr_1')
    expect(
      FakeMarker.instances[0].element
        .querySelector('.pin')
        ?.classList.contains('pin--active'),
    ).toBe(true)
    expect(
      FakeMarker.instances[1].element
        .querySelector('.pin')
        ?.classList.contains('pin--active'),
    ).toBe(false)

    adapter.setHighlightedHit('pr_2')
    expect(
      FakeMarker.instances[0].element
        .querySelector('.pin')
        ?.classList.contains('pin--active'),
    ).toBe(false)
    expect(
      FakeMarker.instances[1].element
        .querySelector('.pin')
        ?.classList.contains('pin--active'),
    ).toBe(true)

    adapter.setHighlightedHit(null)
    expect(
      FakeMarker.instances[1].element
        .querySelector('.pin')
        ?.classList.contains('pin--active'),
    ).toBe(false)
  })

  it('flyTo/jumpTo pass straight through to the underlying map', () => {
    const { adapter, map } = init(fakeGlLibrary())
    adapter.flyTo({ center: [0, 51], zoom: 10 })
    expect(map.flyTo).toHaveBeenCalledWith({ center: [0, 51], zoom: 10 })
    adapter.jumpTo({ center: [1, 52], zoom: 11 })
    expect(map.jumpTo).toHaveBeenCalledWith({ center: [1, 52], zoom: 11 })
  })

  it('opens a popup at the given coordinates hosting the given node', () => {
    const { adapter, map } = init(fakeGlLibrary())
    const node = document.createElement('div')
    adapter.openPopup([-0.98, 51.45], node)

    expect(FakePopup.instances).toHaveLength(1)
    expect(FakePopup.instances[0].lngLat).toEqual([-0.98, 51.45])
    expect(FakePopup.instances[0].domContent).toBe(node)
    expect(FakePopup.instances[0].addTo).toHaveBeenCalledWith(map)
  })

  it('replaces (not stacks) an already-open popup — selecting a different pin auto-swaps', () => {
    const { adapter } = init(fakeGlLibrary())
    adapter.openPopup([-0.98, 51.45], document.createElement('div'))
    adapter.openPopup([-0.97, 51.46], document.createElement('div'))

    expect(FakePopup.instances).toHaveLength(2)
    expect(FakePopup.instances[0].remove).toHaveBeenCalledTimes(1)
    expect(FakePopup.instances[1].remove).not.toHaveBeenCalled()
  })

  it('closePopup removes the open popup', () => {
    const { adapter } = init(fakeGlLibrary())
    adapter.openPopup([-0.98, 51.45], document.createElement('div'))
    adapter.closePopup()
    expect(FakePopup.instances[0].remove).toHaveBeenCalledTimes(1)
  })

  it('destroy removes every marker and the underlying map', () => {
    const { adapter, map } = init(fakeGlLibrary())
    map.emit('load')
    map.queryFeaturesResult = [
      pointFeature('pr_1', '£350k', false, [-0.98, 51.45]),
    ]
    map.emit('moveend', {})

    adapter.destroy()
    expect(FakeMarker.instances[0].remove).toHaveBeenCalledTimes(1)
    expect(map.remove).toHaveBeenCalledTimes(1)
  })
})
