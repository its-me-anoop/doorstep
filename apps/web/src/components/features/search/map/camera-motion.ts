/**
 * M3-DESIGN-SPEC.md §5's motion carve-out: MapLibre/Mapbox's `flyTo`/
 * `jumpTo` are driven by the map library's own internal animation loop
 * on the canvas, not CSS `transition`/`animation` — so the global
 * `@media (prefers-reduced-motion: reduce)` rule already in globals.css
 * (which only zeroes CSS animation/transition durations) never touches
 * them. Every programmatic camera move in the map view goes through
 * `moveCamera` so this is the one place that branch lives, rather than
 * being re-derived at each call site (currently just cluster-click
 * zoom, §1.3 — "Search this area" and the auto-requery checkbox
 * deliberately never move the camera themselves, §5).
 */

export interface CameraTarget {
  /** `[longitude, latitude]` — MapLibre/Mapbox GL's own coordinate order,
   * kept as-is here rather than this codebase's `{ lat, lng }` `GeoPoint`
   * shape, since every caller of this function is already deep in
   * map-library coordinate space. */
  center: [number, number]
  zoom?: number
}

/** The minimal camera surface both `maplibregl.Map` and `mapboxgl.Map`
 * satisfy — a structural type, not an import of either library, so this
 * module (and its tests) never needs the real map library loaded. */
export interface CameraCapableMap {
  jumpTo(target: CameraTarget): void
  flyTo(
    options: CameraTarget & {
      duration?: number
      easing?: (t: number) => number
    },
  ): void
}

/** Capped, not `flyTo`'s own distance-based default, which can run long
 * on a big jump (§5). */
const FLY_TO_DURATION_MS = 600

/** An ease-out-cubic approximation of `--ease-out-expo`
 * (globals.css) — MapLibre/Mapbox need a plain JS easing function, not a
 * CSS `cubic-bezier()` string, so the token itself can't be reused
 * directly; this is the closest shape achievable with a plain function. */
function easeOutCubicApprox(t: number): number {
  return 1 - Math.pow(1 - t, 3)
}

export function moveCamera(
  map: CameraCapableMap,
  target: CameraTarget,
  reduceMotion: boolean,
): void {
  if (reduceMotion) {
    map.jumpTo(target)
    return
  }
  map.flyTo({
    ...target,
    duration: FLY_TO_DURATION_MS,
    easing: easeOutCubicApprox,
  })
}

/** Reads live at call time (never cached), matching every other
 * env/media check in this codebase — a user can toggle their OS's
 * reduced-motion setting between renders, and the map view re-checks
 * this on every camera move rather than freezing the answer at mount.
 * Never throws: `matchMedia` is absent in some non-browser/test
 * environments, and "assume motion is fine" is the safe default there
 * (this function is only ever called client-side, where a real browser
 * always has it). */
export function prefersReducedMotion(): boolean {
  if (
    typeof window === 'undefined' ||
    typeof window.matchMedia !== 'function'
  ) {
    return false
  }
  return window.matchMedia('(prefers-reduced-motion: reduce)').matches
}
