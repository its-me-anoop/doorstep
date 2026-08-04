/**
 * The `properties` entity (PRD §9.2) — the full domain shape. Repositories
 * (adapters/drizzle) map database rows to this type; the ports/
 * `Listing` projection stays a narrower read/write-facing subset, per ISP.
 */

import type {
  Channel,
  CouncilTaxBand,
  EpcRating,
  Furnished,
  PriceQualifier,
  PropertyStatus,
  PropertyType,
  Tenure,
} from './enums'

export interface GeoPoint {
  lat: number
  lng: number
}

export interface PropertyEntity {
  id: string
  listerId: string
  agencyId: string | null
  channel: Channel
  status: PropertyStatus
  propertyType: PropertyType
  title: string
  slug: string
  description: string
  features: string[]
  bedrooms: number
  bathrooms: number
  price: number
  priceQualifier: PriceQualifier
  /** Sale only. */
  tenure: Tenure | null
  /** Rent only, pounds. */
  deposit: number | null
  /** Rent only. */
  furnished: Furnished | null
  /** Rent only. */
  availableFrom: Date | null
  /** Required for rentals at publish. */
  epcRating: EpcRating | null
  councilTaxBand: CouncilTaxBand | null
  newHome: boolean
  /** Private, never rendered publicly. */
  addressLine1: string
  displayAddress: string
  town: string
  outcode: string
  /** Private. */
  postcode: string
  location: GeoPoint
  locationApproximate: boolean
  publishedAt: Date | null
  statusChangedAt: Date | null
  rejectionReason: string | null
  createdAt: Date
  updatedAt: Date
}
