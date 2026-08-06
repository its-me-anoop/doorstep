/**
 * MapAdapter — the ports-and-adapters boundary PRD §15's risk register
 * names explicitly ("swap Mapbox GL for MapLibre + OpenFreeMap tiles
 * behind the existing map component boundary") and M3-DESIGN-SPEC.md §0
 * builds every visual decision against. `MapLibreAdapter` and
 * `MapboxAdapter` (via the shared `gl-map-adapter.ts` core — both
 * libraries expose near-identical runtime APIs, MapLibre being
 * Mapbox GL's own pre-fork ancestor) both satisfy this one interface;
 * `create-map-adapter.ts` is the only place that picks which.
 *
 * Deliberately small (ISP): `map-view.tsx` depends on exactly this
 * surface, never on `maplibregl.Map`/`mapboxgl.Map` directly — no
 * MapLibre/Mapbox type ever crosses this boundary outward.
 */

import type { CameraCapableMap } from './camera-motion'
import type { MapPinFeatureCollection } from './geojson'

export interface MapBounds {
  neLat: number
  neLng: number
  swLat: number
  swLng: number
}

export interface MapAdapterInitOptions {
  /** `[longitude, latitude]`. */
  center: [number, number]
  zoom: number
}

/**
 * `extends CameraCapableMap`: a `MapAdapter` is itself a valid target
 * for `camera-motion.ts`'s `moveCamera` (used internally for §1.3's
 * cluster-click-zoom — the only programmatic camera move this milestone
 * makes, §5) without a second, duplicate `flyTo`/`jumpTo` signature.
 */
export interface MapAdapter extends CameraCapableMap {
  /** Mounts the map into `container` (which the adapter also tags with
   * the `.map-canvas-container` class — §1.1's basemap tint targets
   * `.map-canvas-container canvas`, engine-agnostic CSS on the canvas
   * element only, never the marker/popup DOM layer above it). */
  init(container: HTMLElement, options: MapAdapterInitOptions): void
  /** Replaces the clustered source's data — safe to call before the
   * underlying map has finished loading; the adapter applies it once
   * ready. */
  setData(geojson: MapPinFeatureCollection): void
  /** Fires when a single-listing pin is clicked (never a cluster —
   * cluster clicks zoom internally, §1.3, and never reach this event). */
  on(event: 'select', handler: (hitId: string) => void): () => void
  /** Fires after a *user-initiated* `moveend` only — the adapter itself
   * filters out the programmatic moves its own cluster-click zoom
   * causes, so callers never have to distinguish "did I cause this
   * move." */
  on(event: 'moveend', handler: (bounds: MapBounds) => void): () => void
  /** §1.8 point 3 — the tile CDN/map-library failure case, distinct from
   * the search_unavailable outage (which the results fetch itself
   * already surfaces, independent of this adapter). */
  on(event: 'tilesFailed', handler: () => void): () => void
  /** §1.6's cross-highlight, card → pin direction. `null` clears any
   * highlighted pin. A no-op if the given hit currently has no rendered
   * marker (out of viewport) — highlighting is best-effort, never an
   * error. */
  setHighlightedHit(hitId: string | null): void
  /** §2.4's desktop mini card: a native map-library popup anchored above
   * `coordinates`, hosting `node` (map-view.tsx mounts the shared
   * `MiniCard` React content into `node` itself via `createRoot` — this
   * adapter only owns the imperative "attach this DOM node to the map at
   * this position" part, never React). Calling this again while a popup
   * is already open replaces it (the spec's own "selecting a different
   * pin auto-swaps" rule, §1.4). */
  openPopup(coordinates: [number, number], node: HTMLElement): void
  closePopup(): void
  destroy(): void
}
