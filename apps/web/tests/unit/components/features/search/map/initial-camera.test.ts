import { describe, expect, it } from 'vitest'

import { computeInitialMapCamera } from '@/components/features/search/map/initial-camera'

const readingArea = {
  centre: { lat: 51.4543, lng: -0.9781 },
  radiusMiles: 3,
}

// Where the map's camera starts the first time map view opens — reused
// across a direct/shared `view=map` link (§1.9's SSR-still-renders-the-
// shell rule means the map itself only ever mounts client-side, but its
// starting position should still honestly reflect whatever criteria
// already exist in the URL/route).
describe('computeInitialMapCamera', () => {
  it('centres on a point-radius search, zoomed tighter for a smaller radius', () => {
    const tight = computeInitialMapCamera({
      lat: 51.454,
      lng: -0.9788,
      radius: 1,
    })
    const wide = computeInitialMapCamera({
      lat: 51.454,
      lng: -0.9788,
      radius: 20,
    })
    expect(tight.center).toEqual([-0.9788, 51.454])
    expect(wide.center).toEqual([-0.9788, 51.454])
    expect(tight.zoom).toBeGreaterThan(wide.zoom ?? 0)
  })

  it('defaults the zoom for a point search with no explicit radius to the tightest step', () => {
    const withRadius = computeInitialMapCamera({
      lat: 51.454,
      lng: -0.9788,
      radius: 1,
    })
    const withoutRadius = computeInitialMapCamera({ lat: 51.454, lng: -0.9788 })
    expect(withoutRadius.zoom).toBe(withRadius.zoom)
  })

  it('centres on the bbox midpoint when a bbox is active', () => {
    const camera = computeInitialMapCamera({
      bboxNeLat: 51.5,
      bboxNeLng: -0.9,
      bboxSwLat: 51.4,
      bboxSwLng: -1.0,
    })
    expect(camera.center).toEqual([-0.95, 51.45])
  })

  it('prefers a bbox over a lat/lng point when both are somehow present', () => {
    const camera = computeInitialMapCamera({
      lat: 0,
      lng: 0,
      bboxNeLat: 51.5,
      bboxNeLng: -0.9,
      bboxSwLat: 51.4,
      bboxSwLng: -1.0,
    })
    expect(camera.center).toEqual([-0.95, 51.45])
  })

  it('centres on the curated area when given one and no explicit location', () => {
    const camera = computeInitialMapCamera({}, readingArea)
    expect(camera.center).toEqual([-0.9781, 51.4543])
  })

  it('falls back to the Reading & Thames Valley default with no location and no area', () => {
    const camera = computeInitialMapCamera({})
    expect(camera.center).toBeDefined()
    expect(camera.zoom).toBeDefined()
  })
})
