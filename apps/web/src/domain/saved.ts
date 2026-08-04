import type { Channel } from './enums'
import type { AlertFrequency } from './enums'
import type { GeoPoint } from './property'

/** The `saved_properties` entity — composite PK (userId, propertyId). */
export interface SavedPropertyEntity {
  userId: string
  propertyId: string
  createdAt: Date
}

export interface SavedSearchCriteria {
  channel: Channel
  locationLabel: string
  location: GeoPoint | null
  radiusMetres: number | null
  filters: Record<string, unknown>
}

/** The `saved_searches` entity. */
export interface SavedSearchEntity {
  id: string
  userId: string
  name: string
  criteria: SavedSearchCriteria
  /** MVP always 'none'. */
  alertFrequency: AlertFrequency
  lastAlertedAt: Date | null
  createdAt: Date
  updatedAt: Date
}
