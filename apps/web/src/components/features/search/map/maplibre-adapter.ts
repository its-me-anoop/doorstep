/**
 * The default provider (PRD §15's stated fallback; M3-DESIGN-SPEC.md
 * §0/§1.1): MapLibre GL JS against OpenFreeMap's Positron-family
 * "liberty" style. Only ever imported from behind a `next/dynamic`
 * boundary (map-view.tsx) — importing this module is what pulls
 * `maplibre-gl`'s runtime code into whichever chunk imports it, so
 * nothing outside `map-view.tsx`'s own dynamic import may import this
 * file (PRD §7.1: "list route bundle unchanged by map work").
 *
 * **Production bundler worker-URL fix (post-M3-ship regression, found by
 * a real `next build && next start` run in a real Chromium browser — no
 * unit/e2e test previously caught it because every prior assertion
 * checked `data-listing-ids` or mere canvas/DOM presence, never that a
 * marker actually renders). Two distinct, stacked bugs, both confirmed by
 * instrumenting `window.Worker` in that real run:**
 *
 * 1. MapLibre GL JS v6 resolves its own Web Worker script by reading
 *    `import.meta.url` directly inside its own bundled module
 *    (`getWorkerUrl()`) and falling back to `''` whenever that isn't a
 *    real `https?:` URL. Under this project's Turbopack production
 *    build, that fallback is exactly what fires, so `new Worker('')` is
 *    what actually executes — and it fails immediately without ever
 *    reaching the map's own `error` event (the failure is inside
 *    MapLibre's dispatcher, not routed through `Map`'s own error
 *    channel), so nothing about this was visibly broken, just silently
 *    pin-less and tile-less in production. `setWorkerUrl` is MapLibre's
 *    own documented escape hatch for exactly this bundler-incompatibility
 *    class — the fix below calls it unconditionally, before any `Map` is
 *    constructed.
 * 2. Pointing `setWorkerUrl` at a Turbopack-asset-copied
 *    `new URL('maplibre-gl/dist/maplibre-gl-worker.mjs', import.meta.url)`
 *    gets the *outer* worker script itself loading, but that script's own
 *    source does `import ... from "./maplibre-gl-shared.mjs"` — a plain
 *    relative specifier Turbopack's asset-copy mechanism never rewrites
 *    (it copies the one file you reference byte-for-byte; it doesn't
 *    parse and re-bundle that file's own further imports as additional
 *    hashed assets). The worker then fails a *second* time, now on that
 *    relative import (confirmed via a real `net::ERR_ABORTED` against a
 *    `_next/static/media/maplibre-gl-shared.mjs` Turbopack never
 *    emitted). `scripts/vendor-maplibre-worker.ts` sidesteps this by
 *    serving both files verbatim, side by side, from a stable
 *    `public/vendor/maplibre-gl/` path — Next.js serves `public/` files
 *    unprocessed, so the worker's own unmodified relative import
 *    resolves exactly as it does inside `node_modules` itself.
 *    `scripts/assert-maplibre-worker-vendored.ts` (wired into CI) fails
 *    the build if that vendored copy ever drifts from what
 *    `maplibre-gl`'s own installed version actually ships.
 */

import * as maplibregl from 'maplibre-gl'
import 'maplibre-gl/dist/maplibre-gl.css'

import { createGlMapAdapter, type GlLibrary } from './gl-map-adapter'
import type { MapAdapter } from './map-adapter'

/** OpenFreeMap's Positron-family style — light, near-monochrome, "the
 * correct raw material" for §1.1's basemap tint filter. */
export const OPENFREEMAP_LIBERTY_STYLE_URL =
  'https://tiles.openfreemap.org/styles/liberty'

/** `scripts/vendor-maplibre-worker.ts`'s committed output — see this
 * file's own header comment, point 2, for why the worker script has to
 * be served from here rather than resolved as a Turbopack-hashed asset
 * reference. */
export const MAPLIBRE_WORKER_URL = '/vendor/maplibre-gl/maplibre-gl-worker.mjs'

export function createMapLibreAdapter(): MapAdapter {
  // Idempotent (a global config value MapLibre's dispatcher reads
  // lazily) and cheap — set on every call rather than once at module
  // scope so the fix is visibly tied to *this* factory (this file's own
  // only public entry point) for anyone reading or testing it, matching
  // `mapbox-adapter.ts`'s own `mapboxgl.accessToken = accessToken`
  // convention of configuring the library inside its factory function
  // rather than at import time.
  maplibregl.setWorkerUrl(MAPLIBRE_WORKER_URL)
  return createGlMapAdapter(
    maplibregl as unknown as GlLibrary,
    OPENFREEMAP_LIBERTY_STYLE_URL,
  )
}
