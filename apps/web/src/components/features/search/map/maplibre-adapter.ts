/**
 * The default provider (PRD §15's stated fallback; M3-DESIGN-SPEC.md
 * §0/§1.1): MapLibre GL JS against OpenFreeMap's Positron-family
 * "liberty" style. Only ever imported from behind a `next/dynamic`
 * boundary (map-view.tsx) — importing this module is what pulls
 * `maplibre-gl`'s runtime code into whichever chunk imports it, so
 * nothing outside `map-view.tsx`'s own dynamic import may import this
 * file (PRD §7.1: "list route bundle unchanged by map work").
 */

import * as maplibregl from 'maplibre-gl'
import 'maplibre-gl/dist/maplibre-gl.css'

import { createGlMapAdapter, type GlLibrary } from './gl-map-adapter'
import type { MapAdapter } from './map-adapter'

/** OpenFreeMap's Positron-family style — light, near-monochrome, "the
 * correct raw material" for §1.1's basemap tint filter. */
export const OPENFREEMAP_LIBERTY_STYLE_URL =
  'https://tiles.openfreemap.org/styles/liberty'

export function createMapLibreAdapter(): MapAdapter {
  return createGlMapAdapter(
    maplibregl as unknown as GlLibrary,
    OPENFREEMAP_LIBERTY_STYLE_URL,
  )
}
