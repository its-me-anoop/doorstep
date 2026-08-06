/**
 * adapters/postcodesio/ — implements Geocoder (ports/geocoder.ts) against
 * postcodes.io (PRD §8.6, §11): free, open ONS data, no API key, GB-only.
 *
 * `geocode` (PostcodeGeocoder) — the postcode fast path:
 *  - A full UK postcode (e.g. "RG30 1AA", also accepted unspaced/lower-
 *    case, e.g. "rg301aa") resolves via GET /postcodes/{postcode}.
 *  - A partial postcode — an outcode on its own (e.g. "RG30") — resolves
 *    via GET /outcodes/{outcode} to that outcode's centroid, exactly as
 *    PRD §8.6 describes ("includes outcode centroids for partial
 *    postcodes").
 *  - Anything that matches neither shape returns null *without* calling
 *    postcodes.io at all — it is not this adapter's job to reject bad
 *    input, it simply cannot resolve it. GET /api/v1/geocode (the only
 *    caller) turns that null into `{ data: { results: [] } } `. Free-text
 *    place queries ("Reading town centre") are a real, expected case
 *    here, not a client error — services/geocoding/search-geocode.ts
 *    falls through to a PlaceSearcher (Mapbox when configured, else this
 *    same adapter's own `searchPlaces`) whenever `geocode` returns null.
 *
 * `label` (ports/geocoder.ts's GeocodeResult) is the town-ish description
 * the task brief calls for: `admin_district` when postcodes.io returns
 * one, falling back to `parish` (both can be null for some postcodes —
 * e.g. an unparished area with no district — though not simultaneously
 * in practice). The /outcodes endpoint returns `admin_district` as an
 * array (an outcode spans several districts, e.g. RG30 covers both
 * Reading and West Berkshire) — the first entry is used, same
 * "good enough label, not an authoritative boundary lookup" spirit as
 * the full-postcode case.
 *
 * `searchPlaces` (PlaceSearcher) — the free-text autocomplete fallback
 * PRD §10 SRCH-1 calls for, using postcodes.io's own Places API
 * (backed by OS Open Names GB — a separate, free dataset from the
 * postcode ones above, no API key either). This is the DEFAULT adapter
 * for place search — used whenever MAPBOX_ACCESS_TOKEN is unset (see
 * lib/composition.ts and adapters/mapbox/'s doc comment for the
 * documented PRD deviation this represents: PRD §8.6 names Mapbox
 * Geocoding as the free-text provider, with no postcodes.io fallback
 * mentioned). OS Open Names is place/feature data, not postcode data, so
 * a result never carries a specific outcode — `PlaceSuggestion.outcode`
 * is always `null` here (Mapbox's own adapter has the same limitation,
 * for the same reason).
 */

import type { Geocoder, GeocodeResult, PlaceSuggestion } from '@/ports/geocoder'

const POSTCODES_IO_BASE_URL = 'https://api.postcodes.io'

// Outward code: 1-2 letters, 1 digit, then an optional letter or digit
// (covers every current UK postcode area, e.g. "RG30", "SW1A", "M1").
const OUTCODE = '[A-Z]{1,2}\\d[A-Z\\d]?'
// A full postcode is that outward code, optional whitespace, then the
// inward code (always 1 digit + 2 letters).
const FULL_POSTCODE = new RegExp(`^(${OUTCODE})\\s*(\\d[A-Z]{2})$`, 'i')
const OUTCODE_ONLY = new RegExp(`^${OUTCODE}$`, 'i')

interface PostcodesIoPostcodeResult {
  latitude: number
  longitude: number
  outcode: string
  admin_district: string | null
  parish: string | null
}

interface PostcodesIoOutcodeResult {
  latitude: number
  longitude: number
  outcode: string
  admin_district: string[]
}

/** The subset of postcodes.io's Places API (OS Open Names GB) result
 * fields this adapter uses to build a label — the real response carries
 * several more (id, id_1, name_1_lang, local_type, ...) that are either
 * redundant with these or not useful for a search suggestion. */
interface PostcodesIoPlaceResult {
  name_1: string
  county_unitary: string | null
  district_borough: string | null
  region: string | null
  country: string | null
  latitude: number
  longitude: number
}

export class PostcodesIoGeocoder implements Geocoder {
  async geocode(query: string): Promise<GeocodeResult | null> {
    const trimmed = query.trim()

    const fullMatch = trimmed.match(FULL_POSTCODE)
    if (fullMatch) {
      const [, outward, inward] = fullMatch
      return this.lookupPostcode(`${outward} ${inward}`.toUpperCase())
    }

    if (OUTCODE_ONLY.test(trimmed)) {
      return this.lookupOutcode(trimmed.toUpperCase())
    }

    return null
  }

  private async lookupPostcode(
    postcode: string,
  ): Promise<GeocodeResult | null> {
    const response = await fetch(
      `${POSTCODES_IO_BASE_URL}/postcodes/${encodeURIComponent(postcode)}`,
    )
    if (!response.ok) return null

    const body = (await response.json()) as {
      status: number
      result: PostcodesIoPostcodeResult | null
    }
    if (!body.result) return null

    const { result } = body
    return {
      lat: result.latitude,
      lng: result.longitude,
      label: result.admin_district ?? result.parish ?? result.outcode,
      outcode: result.outcode,
    }
  }

  private async lookupOutcode(outcode: string): Promise<GeocodeResult | null> {
    const response = await fetch(
      `${POSTCODES_IO_BASE_URL}/outcodes/${encodeURIComponent(outcode)}`,
    )
    if (!response.ok) return null

    const body = (await response.json()) as {
      status: number
      result: PostcodesIoOutcodeResult | null
    }
    if (!body.result) return null

    const { result } = body
    return {
      lat: result.latitude,
      lng: result.longitude,
      label: result.admin_district[0] ?? result.outcode,
      outcode: result.outcode,
    }
  }

  async searchPlaces(query: string): Promise<PlaceSuggestion[]> {
    const trimmed = query.trim()
    if (!trimmed) return []

    const response = await fetch(
      `${POSTCODES_IO_BASE_URL}/places?q=${encodeURIComponent(trimmed)}`,
    )
    if (!response.ok) return []

    const body = (await response.json()) as {
      status: number
      result: PostcodesIoPlaceResult[] | null
    }

    return (body.result ?? []).map((place) => ({
      name: place.name_1,
      label: buildPlaceLabel(place),
      lat: place.latitude,
      lng: place.longitude,
      outcode: null,
    }))
  }
}

/** `name_1, {county/district}, region, country`, deduplicating any
 * segment that repeats the one before it (e.g. a place whose
 * county_unitary equals its own name_1). */
function buildPlaceLabel(place: PostcodesIoPlaceResult): string {
  const segments = [
    place.name_1,
    place.county_unitary ?? place.district_borough,
    place.region,
    place.country,
  ].filter((segment): segment is string => Boolean(segment))

  const deduped = segments.filter(
    (segment, index) => index === 0 || segment !== segments[index - 1],
  )
  return deduped.join(', ')
}
