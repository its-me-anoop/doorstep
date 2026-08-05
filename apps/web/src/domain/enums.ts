/**
 * Enums shared across domain entities, mirroring PRD §9.2 exactly.
 * Modelled as string-literal unions (not TS `enum`) to keep the values
 * trivially serialisable and to match the style already used in ports/.
 */

/** properties.channel */
export type Channel = 'sale' | 'rent'

/** properties.status — see property-status-machine.ts for the transition table (PRD §9.3). */
export type PropertyStatus =
  | 'draft'
  | 'pending_review'
  | 'rejected'
  | 'published'
  | 'under_offer'
  | 'completed'
  | 'hidden'
  | 'archived'

/** properties.property_type */
export type PropertyType =
  | 'detached'
  | 'semi_detached'
  | 'terraced'
  | 'flat'
  | 'bungalow'
  | 'maisonette'
  | 'land'
  | 'other'

/** properties.price_qualifier */
export type PriceQualifier =
  'fixed' | 'guide_price' | 'offers_over' | 'offers_in_region' | 'poa'

/** properties.tenure — sale only */
export type Tenure = 'freehold' | 'leasehold' | 'share_of_freehold' | 'unknown'

/** properties.furnished — rent only */
export type Furnished = 'furnished' | 'part_furnished' | 'unfurnished'

/** properties.epc_rating */
export type EpcRating = 'A' | 'B' | 'C' | 'D' | 'E' | 'F' | 'G'

/** properties.council_tax_band */
export type CouncilTaxBand = 'A' | 'B' | 'C' | 'D' | 'E' | 'F' | 'G' | 'H'

/** users.role */
export type UserRole = 'user' | 'owner' | 'agent' | 'admin'

/**
 * Runtime companion to `UserRole`, needed anywhere a value (Firebase
 * custom claim, JWT payload field) has to be checked against the union
 * rather than just typed as it (PRD §8.4). Kept next to the type it
 * mirrors so the two can never drift.
 */
export const USER_ROLES: readonly UserRole[] = [
  'user',
  'owner',
  'agent',
  'admin',
]

export function isUserRole(value: unknown): value is UserRole {
  return (
    typeof value === 'string' &&
    (USER_ROLES as readonly string[]).includes(value)
  )
}

/** users.status */
export type UserStatus = 'active' | 'suspended' | 'banned'

/** enquiries.status */
export type EnquiryStatus = 'new' | 'contacted' | 'closed'

/** property_images.kind */
export type ImageKind = 'photo' | 'floorplan' | 'epc'

/**
 * Runtime companion to `ImageKind`, mirroring USER_ROLES above — needed by
 * lib/validation/image.ts to build a zod enum without duplicating the
 * literal list (PRD §6.5 LST-3: "tag an image as floorplan or EPC").
 */
export const IMAGE_KINDS: readonly ImageKind[] = ['photo', 'floorplan', 'epc']

/** saved_searches.alert_frequency */
export type AlertFrequency = 'none' | 'daily' | 'instant'

/** outbox.op */
export type OutboxOp = 'upsert' | 'delete'
