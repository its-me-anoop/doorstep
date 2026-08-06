/**
 * Maps the results view's own `PublicSearchHit[]` (the exact data the
 * list column already renders) into the GeoJSON `FeatureCollection` the
 * map's clustered source consumes (M3-DESIGN-SPEC.md §1.2/§1.3). This is
 * the one place that translation happens — map and list read the same
 * `PublicSearchResult` from the same fetch (results-view.tsx), so there
 * is no second query path to drift out of sync with the first (PRD §13's
 * M3 exit criterion: "map and list return identical results for the
 * same criteria" is structural, not coincidental, because of this).
 *
 * Deliberately a thin DTO: a pin only needs an id (to look the full hit
 * back up for the mini card, §1.4), a compact label and the under-offer
 * flag (§1.2's two-state pin). Everything else the mini card shows
 * (price/address/beds/type/cover image) is read from the same
 * `PublicSearchHit[]` array already in memory by id, not duplicated into
 * this shape — the map never becomes a second, fuller data contract.
 */

import { formatPinPrice } from '@/domain/money'
import type { PublicSearchHit } from '@/services/search/search-listings'

export interface MapPinProperties {
  hitId: string
  /** §1.2's pin content: the compact abbreviated price ("£350k", "£1.3m",
   * the full pcm figure for rent) for a published listing, or the status
   * word alone ("Sold STC"/"Let Agreed") for an under-offer one — never
   * both, matching the detail page's own "no price, just the status
   * message" convention for that state (M2 §5.2). */
  label: string
  underOffer: boolean
}

export type MapPinFeature = GeoJSON.Feature<GeoJSON.Point, MapPinProperties>
export type MapPinFeatureCollection = GeoJSON.FeatureCollection<
  GeoJSON.Point,
  MapPinProperties
>

/** `displayStatus` is `getDisplayStatus`'s output (search-listings.ts):
 * the literal `"published"` for a live listing, else the friendly status
 * label — the same precedence ResultCard's own `freshnessOrStatusBadge`
 * already reads for its under-offer branch. */
function pinLabel(hit: PublicSearchHit): {
  label: string
  underOffer: boolean
} {
  if (hit.displayStatus !== 'published') {
    return { label: hit.displayStatus, underOffer: true }
  }
  const label =
    hit.priceQualifier === 'poa'
      ? 'POA'
      : formatPinPrice(hit.channel, hit.price)
  return { label, underOffer: false }
}

function hitToFeature(hit: PublicSearchHit): MapPinFeature {
  const { label, underOffer } = pinLabel(hit)
  return {
    type: 'Feature',
    geometry: {
      type: 'Point',
      // GeoJSON coordinate order is [longitude, latitude] — the opposite
      // of this codebase's own `GeoPoint` field order (`{ lat, lng }`,
      // domain/property.ts) — so this is the one place that reordering
      // happens, not left to each caller to remember.
      coordinates: [hit.geo.lng, hit.geo.lat],
    },
    properties: { hitId: hit.id, label, underOffer },
  }
}

export function hitsToFeatureCollection(
  hits: PublicSearchHit[],
): MapPinFeatureCollection {
  return {
    type: 'FeatureCollection',
    features: hits.map(hitToFeature),
  }
}
