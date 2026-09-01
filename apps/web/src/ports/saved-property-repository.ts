/**
 * SavedPropertyRepository — favourites (PRD §6.3 ACC-2, domain/saved.ts).
 */

import type { SavedPropertyEntity } from '@/domain/saved'

export type SavedProperty = SavedPropertyEntity

export interface SavedPropertyRepository {
  listByUser(userId: string): Promise<SavedProperty[]>
  isSaved(userId: string, propertyId: string): Promise<boolean>
  /** Idempotent — saving an already-saved pair is a no-op. */
  save(userId: string, propertyId: string): Promise<SavedProperty>
  /** Idempotent — unsaving a missing pair is a no-op. */
  unsave(userId: string, propertyId: string): Promise<void>
  /** GDPR account deletion. */
  deleteAllForUser(userId: string): Promise<number>
}
