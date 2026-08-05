/**
 * adapters/postcodesio/ — implements Geocoder (ports/geocoder.ts) against
 * postcodes.io (PRD §8.6, §11): free, open ONS data, no API key, GB-only.
 *
 * M1 scope is the postcode fast path only, per this milestone's task:
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
 *    here, not a client error: PRD §8.6 routes those to Mapbox Geocoding
 *    with GB bias, which is TODO(M2) — adapters/mapbox/ is still a stub.
 *    Composing the two into one Geocoder (try this adapter first, fall
 *    back to Mapbox on a null) is that M2 task's job, not this one's.
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
 */

import type { Geocoder, GeocodeResult } from '@/ports/geocoder'

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
}
