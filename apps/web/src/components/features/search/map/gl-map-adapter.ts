/**
 * The shared implementation behind both `MapLibreAdapter` and
 * `MapboxAdapter` (M3-DESIGN-SPEC.md §0/§1.1: "every visual decision is
 * specified as engine-agnostic CSS... so the same design ships
 * identically whichever provider is active"). MapLibre GL JS and
 * Mapbox GL JS expose near-identical runtime APIs — unsurprising, since
 * MapLibre is a fork of Mapbox GL JS from before Mapbox's licence
 * change — so one implementation behind a small injected `GlLibrary`
 * (just the handful of classes this file actually touches) covers both,
 * rather than duplicating the marker-sync/cluster-click/event-wiring
 * logic per provider. Each provider's own thin wrapper module
 * (`maplibre-adapter.ts`, `mapbox-adapter.ts`) only has to supply its
 * own imported module and default style URL.
 *
 * Rendering choice (§1.2/§1.3, "HTML markers or symbol layers — choose
 * for crisp text at the spec sizes; justify"): **HTML markers**, synced
 * to the clustered GeoJSON source via `querySourceFeatures` on
 * `moveend`/`zoomend`/`sourcedata` (the standard "GeoJSON cluster + HTML
 * marker" pattern both libraries document). Justification: the pin/
 * cluster anatomy is plain CSS box-model — a variable-width price pill
 * (`white-space: nowrap`, intrinsic width) that a GL symbol layer's
 * fixed-size icon would need `icon-text-fit` raster-generation gymnastics
 * to approximate — and the hover/cross-highlight state (§1.2/§1.6,
 * `transform: scale(1.12)`) is a CSS transition, not a repaint-driven
 * data-expression. HTML markers let every other design-system component
 * in this codebase (radius/colour/spacing tokens) apply directly, with
 * no second, raster-based rendering pipeline to keep in sync with it.
 * Trade-off, stated plainly: marker positions are re-synced at gesture
 * *end* (`moveend`/`zoomend`), not continuously during a drag the way
 * the GL canvas itself renders — an accepted simplification (nothing in
 * the spec requires continuous drag-tracking) that avoids per-frame DOM
 * churn during a pan/zoom gesture.
 */

import {
  moveCamera,
  prefersReducedMotion,
  type CameraTarget,
} from './camera-motion'
import { createClusterElement } from './cluster-marker'
import type { MapPinFeatureCollection } from './geojson'
import type {
  MapAdapter,
  MapAdapterInitOptions,
  MapBounds,
} from './map-adapter'
import { createPinElement, type PinHandle } from './pin-marker'

const SOURCE_ID = 'hits'
/** Implementation defaults — the design spec specifies the *count-step*
 * sizing (§1.3's 3-step table) but not a literal `clusterRadius` pixel
 * value or `clusterMaxZoom`; these are reasonable defaults for a
 * portal-density result set, tuned the same way most MapLibre/Mapbox
 * cluster examples default (60px reads as "nearby enough to be the same
 * neighbourhood" at typical street-level zooms without over-clustering
 * at wider zooms). */
const CLUSTER_RADIUS_PX = 60
const CLUSTER_MAX_ZOOM = 16

const EMPTY_FEATURE_COLLECTION: MapPinFeatureCollection = {
  type: 'FeatureCollection',
  features: [],
}

interface GlLngLatBounds {
  getNorth(): number
  getSouth(): number
  getEast(): number
  getWest(): number
}

interface GlMapEvent {
  originalEvent?: unknown
}

interface GlSourceDataEvent {
  sourceId?: string
  isSourceLoaded?: boolean
  dataType?: string
}

interface GlErrorEvent {
  sourceId?: string
}

interface GlGeoJSONSource {
  setData(data: MapPinFeatureCollection): void
  getClusterExpansionZoom(clusterId: number): Promise<number>
}

interface GlCameraOptions {
  center?: [number, number]
  zoom?: number
  duration?: number
  easing?: (t: number) => number
}

interface GlMarkerInstance {
  setLngLat(lngLat: [number, number]): GlMarkerInstance
  addTo(map: GlMapInstance): GlMarkerInstance
  remove(): void
}

interface GlPopupInstance {
  setLngLat(lngLat: [number, number]): GlPopupInstance
  setDOMContent(node: HTMLElement): GlPopupInstance
  addTo(map: GlMapInstance): GlPopupInstance
  remove(): void
}

export interface GlMapInstance {
  on(event: string, handler: (event: never) => void): void
  addControl(control: unknown, position?: string): void
  addSource(id: string, source: Record<string, unknown>): void
  getSource(id: string): unknown
  querySourceFeatures(
    sourceId: string,
    params?: Record<string, unknown>,
  ): GeoJSON.Feature[]
  getBounds(): GlLngLatBounds
  getCanvas(): HTMLElement
  flyTo(options: GlCameraOptions): void
  jumpTo(options: GlCameraOptions): void
  remove(): void
}

/** The structural surface this adapter needs from either `maplibre-gl`'s
 * or `mapbox-gl`'s exported module. */
export interface GlLibrary {
  Map: new (options: Record<string, unknown>) => GlMapInstance
  Marker: new (options: {
    element: HTMLElement
    anchor?: string
  }) => GlMarkerInstance
  Popup: new (options: Record<string, unknown>) => GlPopupInstance
  NavigationControl: new (options?: Record<string, unknown>) => unknown
  AttributionControl: new (options?: Record<string, unknown>) => unknown
}

interface MarkerEntry {
  marker: GlMarkerInstance
  pin?: PinHandle
}

export function createGlMapAdapter(
  gl: GlLibrary,
  styleUrl: string,
): MapAdapter {
  let map: GlMapInstance | null = null
  let pendingData: MapPinFeatureCollection = EMPTY_FEATURE_COLLECTION
  let activeHitId: string | null = null
  let popup: GlPopupInstance | null = null

  const markers = new Map<string, MarkerEntry>()
  const pinHandlesByHitId = new Map<string, PinHandle>()

  const selectHandlers = new Set<(hitId: string) => void>()
  const moveendHandlers = new Set<(bounds: MapBounds) => void>()
  const tilesFailedHandlers = new Set<() => void>()

  function clearMarkers() {
    for (const entry of markers.values()) entry.marker.remove()
    markers.clear()
    pinHandlesByHitId.clear()
  }

  function syncMarkers() {
    if (!map) return
    const features = map.querySourceFeatures(SOURCE_ID)
    const seen = new Set<string>()

    for (const feature of features) {
      const properties = (feature.properties ?? {}) as Record<string, unknown>
      const geometry = feature.geometry as GeoJSON.Point
      const [lng, lat] = geometry.coordinates as [number, number]
      const isCluster = Boolean(properties.cluster)
      const key = isCluster
        ? `cluster-${String(properties.cluster_id)}`
        : `hit-${String(properties.hitId)}`

      // `querySourceFeatures` can return the same feature more than once
      // (tile-boundary duplication) — only the first occurrence per key
      // is placed.
      if (seen.has(key)) continue
      seen.add(key)
      if (markers.has(key)) continue

      if (isCluster) {
        const clusterId = Number(properties.cluster_id)
        const count = Number(properties.point_count)
        const handle = createClusterElement(count, () => {
          const source = map?.getSource(SOURCE_ID) as
            GlGeoJSONSource | undefined
          source
            ?.getClusterExpansionZoom(clusterId)
            .then((zoom) => {
              const target: CameraTarget = { center: [lng, lat], zoom }
              moveCamera(adapter, target, prefersReducedMotion())
            })
            .catch(() => {
              // A best-effort UX affordance — a failed expansion-zoom
              // lookup leaves the camera exactly where it was, which is
              // an acceptable no-op, not an error state worth surfacing.
            })
        })
        const marker = new gl.Marker({
          element: handle.element,
          anchor: 'bottom',
        })
        marker.setLngLat([lng, lat]).addTo(map)
        markers.set(key, { marker })
      } else {
        const hitId = String(properties.hitId)
        const handle = createPinElement(
          {
            label: String(properties.label),
            underOffer: Boolean(properties.underOffer),
          },
          () => {
            for (const handler of selectHandlers) handler(hitId)
          },
        )
        handle.setActive(hitId === activeHitId)
        const marker = new gl.Marker({
          element: handle.element,
          anchor: 'bottom',
        })
        marker.setLngLat([lng, lat]).addTo(map)
        markers.set(key, { marker, pin: handle })
        pinHandlesByHitId.set(hitId, handle)
      }
    }

    for (const [key, entry] of markers) {
      if (seen.has(key)) continue
      entry.marker.remove()
      markers.delete(key)
      if (entry.pin) {
        for (const [hitId, pin] of pinHandlesByHitId) {
          if (pin === entry.pin) pinHandlesByHitId.delete(hitId)
        }
      }
    }
  }

  // `on()`'s three-overload public signature (map-adapter.ts) can't be
  // expressed as one implementation signature without `never` — the
  // usual TS ergonomics gap for a small polymorphic event registry. The
  // trailing `as MapAdapter` cast is the accepted escape hatch; every
  // call site outside this file only ever sees the strongly-typed public
  // `MapAdapter` overloads, and this internal `switch`-by-string is
  // covered directly by this file's own test suite.
  const adapter: MapAdapter = {
    init(container, options: MapAdapterInitOptions) {
      container.classList.add('map-canvas-container')

      map = new gl.Map({
        container,
        style: styleUrl,
        center: options.center,
        zoom: options.zoom,
        attributionControl: false,
      })

      map.addControl(new gl.NavigationControl(), 'bottom-right')
      map.addControl(
        new gl.AttributionControl({ compact: true }),
        'bottom-left',
      )

      // §4/§6: the base canvas is non-textual by construction — made
      // explicit rather than left to each library's own default. Not
      // applied to `container` itself, which would also hide the mini
      // card popup/panel this same container hosts.
      map.getCanvas().setAttribute('aria-hidden', 'true')

      map.on('load', () => {
        map?.addSource(SOURCE_ID, {
          type: 'geojson',
          data: pendingData,
          cluster: true,
          clusterRadius: CLUSTER_RADIUS_PX,
          clusterMaxZoom: CLUSTER_MAX_ZOOM,
        })
        syncMarkers()
      })

      map.on('moveend', (event: GlMapEvent) => {
        syncMarkers()
        // Filters out the programmatic moves this adapter's own
        // cluster-click zoom causes (and the initial camera placement) —
        // MapLibre/Mapbox both set `originalEvent` only for a genuine
        // user gesture (mouse/touch/wheel).
        if (!event?.originalEvent || !map) return
        const bounds = map.getBounds()
        const next: MapBounds = {
          neLat: bounds.getNorth(),
          neLng: bounds.getEast(),
          swLat: bounds.getSouth(),
          swLng: bounds.getWest(),
        }
        for (const handler of moveendHandlers) handler(next)
      })

      map.on('zoomend', () => syncMarkers())

      map.on('sourcedata', (event: GlSourceDataEvent) => {
        if (event.sourceId === SOURCE_ID && event.isSourceLoaded) {
          syncMarkers()
        }
      })

      map.on('error', (event: GlErrorEvent) => {
        // A `hits`-source error is a data problem the results fetch's
        // own outage handling already covers, not a tile failure — §1.8
        // point 3 is specifically the map-library/tile-CDN case.
        if (event.sourceId === SOURCE_ID) return
        for (const handler of tilesFailedHandlers) handler()
      })
    },

    setData(geojson) {
      pendingData = geojson
      const source = map?.getSource(SOURCE_ID) as GlGeoJSONSource | undefined
      source?.setData(geojson)
    },

    on(event: 'select' | 'moveend' | 'tilesFailed', handler: never) {
      const set =
        event === 'select'
          ? selectHandlers
          : event === 'moveend'
            ? moveendHandlers
            : tilesFailedHandlers
      set.add(handler)
      return () => set.delete(handler)
    },

    setHighlightedHit(hitId) {
      if (activeHitId !== null) {
        pinHandlesByHitId.get(activeHitId)?.setActive(false)
      }
      activeHitId = hitId
      if (hitId !== null) {
        pinHandlesByHitId.get(hitId)?.setActive(true)
      }
    },

    flyTo(target) {
      map?.flyTo(target)
    },

    jumpTo(target) {
      map?.jumpTo(target)
    },

    openPopup(coordinates, node) {
      if (!map) return
      // §1.4: "selecting a different pin auto-swaps, old card dismisses
      // without a second click" — replacing rather than stacking.
      popup?.remove()
      popup = new gl.Popup({
        closeButton: false,
        closeOnClick: false,
        offset: 12,
        className: 'mini-card-popup',
      })
        .setLngLat(coordinates)
        .setDOMContent(node)
        .addTo(map)
    },

    closePopup() {
      popup?.remove()
      popup = null
    },

    destroy() {
      clearMarkers()
      popup?.remove()
      popup = null
      map?.remove()
      map = null
      selectHandlers.clear()
      moveendHandlers.clear()
      tilesFailedHandlers.clear()
    },
  } as MapAdapter

  return adapter
}
