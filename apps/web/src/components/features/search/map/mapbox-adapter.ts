/**
 * The Mapbox GL provider — selected by `create-map-adapter.ts` only when
 * `NEXT_PUBLIC_MAPBOX_ACCESS_TOKEN` is set (no token is provisioned in
 * this project's environments today, matching `.env.example`'s own
 * documented `MAPBOX_ACCESS_TOKEN` precedent for the unrelated
 * server-side Geocoding token). Code-complete, env-gated: exercised by
 * `tests/unit/components/features/search/map/mapbox-adapter.test.ts`
 * (mocked `mapbox-gl`) but not by an e2e/integration run, since there is
 * nothing to point one at yet — the same documented posture
 * `adapters/mapbox/`'s own geocoder already takes for the same reason.
 *
 * Only ever imported from `create-map-adapter.ts`'s own dynamic branch
 * — never imported eagerly, so a real user (always MapLibre today) never
 * downloads `mapbox-gl`'s runtime at all.
 */

import mapboxgl from 'mapbox-gl'
import 'mapbox-gl/dist/mapbox-gl.css'

import { createGlMapAdapter, type GlLibrary } from './gl-map-adapter'
import type { MapAdapter } from './map-adapter'

const MAPBOX_LIGHT_STYLE_URL = 'mapbox://styles/mapbox/light-v11'

export function createMapboxAdapter(accessToken: string): MapAdapter {
  mapboxgl.accessToken = accessToken
  return createGlMapAdapter(
    mapboxgl as unknown as GlLibrary,
    MAPBOX_LIGHT_STYLE_URL,
  )
}
