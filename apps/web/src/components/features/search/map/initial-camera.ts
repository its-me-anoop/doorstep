/**
 * Where the map's camera starts the first time map view mounts
 * (M3-DESIGN-SPEC.md §1.9's SSR note: the shell always server-renders
 * first, the map itself only ever mounts client-side — but its starting
 * position should still honestly reflect whatever location criteria
 * already exist in the URL). Reuses `lib/areas.ts`'s `centre`/
 * `radiusMiles` fields, which that file's own doc comment already
 * reserves for exactly this ("the M3 map default").
 */

import type { SearchUrlState } from '@/lib/search-url'

/** The one slice of `lib/areas.ts`'s `AreaDefinition` this module
 * actually needs — a narrow shape (ISP) rather than a dependency on the
 * whole curated-area registry type, so results-view.tsx (a client
 * component) can build one from its own small `areaCentre`/
 * `areaRadiusMiles` props without importing `AreaDefinition` itself. */
export interface MapCameraArea {
  centre: { lat: number; lng: number }
  radiusMiles: number
}

/** `zoom` is always present here, unlike `CameraTarget`'s own optional
 * one (camera-motion.ts) — an *initial* camera always needs a concrete
 * starting zoom, so `MapAdapterInitOptions` (map-adapter.ts) requires
 * it too; this is the type that flows into that. */
export interface InitialCamera {
  center: [number, number]
  zoom: number
}

/** "Reading & the Thames Valley," this product's own unrestricted-scope
 * label (`lib/search-heading.ts`) — the fallback when a map opens with
 * no point, bbox or curated area to anchor to. Matches `lib/areas.ts`'s
 * own Reading entry's `centre`, at a wider town-scale zoom appropriate
 * for "no specific location yet." */
const DEFAULT_CAMERA: InitialCamera = { center: [-0.9781, 51.4543], zoom: 11 }

/** Each doubling of search radius drops the zoom roughly one level,
 * anchored so a 1-mile radius (the API's own default, see
 * `services/search/search-listings.ts`) reads at a tight,
 * street-and-neighbourhood-legible zoom. No literal value for this
 * exists in the design spec (it specifies pin/cluster anatomy, not
 * camera zoom maths) — a documented, reasoned default rather than an
 * arbitrary one. */
function zoomForRadiusMiles(radiusMiles: number): number {
  const zoom = 14 - Math.log2(radiusMiles)
  return Math.min(15, Math.max(9, Math.round(zoom)))
}

const DEFAULT_POINT_RADIUS_MILES = 1

/** The `MapAdapter` seam only exposes `center`+`zoom` (`init`/`flyTo`/
 * `jumpTo` — no `fitBounds`), so a bbox is approximated by its own
 * midpoint at a fixed, reasonable zoom rather than precisely fit —
 * accepted, since a bbox context only ever arises *while the map is
 * already open and the user is looking at it* (§1.5's "Search this
 * area"/auto-requery never move the camera themselves, §5), making this
 * function's own bbox branch relevant only to the corner case of a
 * shared link that already carries `view=map` and a bbox. */
const BBOX_APPROXIMATE_ZOOM = 12

export function computeInitialMapCamera(
  state: SearchUrlState,
  area?: MapCameraArea,
): InitialCamera {
  const hasBbox =
    state.bboxNeLat !== undefined &&
    state.bboxNeLng !== undefined &&
    state.bboxSwLat !== undefined &&
    state.bboxSwLng !== undefined

  if (
    hasBbox &&
    state.bboxNeLat !== undefined &&
    state.bboxNeLng !== undefined &&
    state.bboxSwLat !== undefined &&
    state.bboxSwLng !== undefined
  ) {
    return {
      center: [
        (state.bboxNeLng + state.bboxSwLng) / 2,
        (state.bboxNeLat + state.bboxSwLat) / 2,
      ],
      zoom: BBOX_APPROXIMATE_ZOOM,
    }
  }

  if (state.lat !== undefined && state.lng !== undefined) {
    return {
      center: [state.lng, state.lat],
      zoom: zoomForRadiusMiles(state.radius ?? DEFAULT_POINT_RADIUS_MILES),
    }
  }

  if (area) {
    return {
      center: [area.centre.lng, area.centre.lat],
      zoom: zoomForRadiusMiles(area.radiusMiles),
    }
  }

  return DEFAULT_CAMERA
}
