/**
 * The provider seam (M3-DESIGN-SPEC.md §0, PRD §15): MapLibre + OpenFreeMap
 * by default, Mapbox GL when `NEXT_PUBLIC_MAPBOX_ACCESS_TOKEN` is
 * configured. This is the *only* place that decision is made — map-view.tsx
 * calls `createMapAdapter()` and works against the returned `MapAdapter`
 * port, never against either concrete library.
 *
 * Async and dynamically importing each provider module (rather than a
 * static `import` of both at the top of this file) for the same reason
 * `map-view.tsx` itself is only reached via `next/dynamic`: this file
 * lives inside that same dynamically-imported map chunk, but *within*
 * that chunk, the unused provider's ~200KB+ library still shouldn't ship
 * to a browser that's never going to use it. Today that's every real
 * user — no Mapbox token exists yet — so this keeps `mapbox-gl` out of
 * the map chunk entirely for the common case, not just out of the list
 * route.
 */

import type { MapAdapter } from './map-adapter'

export function readMapboxAccessToken(): string | undefined {
  const token = process.env.NEXT_PUBLIC_MAPBOX_ACCESS_TOKEN
  return token && token.length > 0 ? token : undefined
}

export async function createMapAdapter(): Promise<MapAdapter> {
  const token = readMapboxAccessToken()

  if (token) {
    const { createMapboxAdapter } = await import('./mapbox-adapter')
    return createMapboxAdapter(token)
  }

  const { createMapLibreAdapter } = await import('./maplibre-adapter')
  return createMapLibreAdapter()
}
