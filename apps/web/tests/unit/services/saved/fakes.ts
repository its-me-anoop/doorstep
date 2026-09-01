/**
 * In-memory fakes for services/saved/* and services/account/* tests.
 */

import type { SavedSearchCriteria } from '@/domain/saved'
import type {
  SavedProperty,
  SavedPropertyRepository,
} from '@/ports/saved-property-repository'
import {
  SavedSearchNotFoundError,
  type NewSavedSearch,
  type SavedSearch,
  type SavedSearchRepository,
} from '@/ports/saved-search-repository'

export class FakeSavedPropertyRepository implements SavedPropertyRepository {
  private readonly keys = new Map<string, SavedProperty>()

  private key(userId: string, propertyId: string): string {
    return `${userId}:${propertyId}`
  }

  async listByUser(userId: string): Promise<SavedProperty[]> {
    return [...this.keys.values()].filter((row) => row.userId === userId)
  }

  async isSaved(userId: string, propertyId: string): Promise<boolean> {
    return this.keys.has(this.key(userId, propertyId))
  }

  async save(userId: string, propertyId: string): Promise<SavedProperty> {
    const existing = this.keys.get(this.key(userId, propertyId))
    if (existing) return existing
    const created: SavedProperty = {
      userId,
      propertyId,
      createdAt: new Date(),
    }
    this.keys.set(this.key(userId, propertyId), created)
    return created
  }

  async unsave(userId: string, propertyId: string): Promise<void> {
    this.keys.delete(this.key(userId, propertyId))
  }

  async deleteAllForUser(userId: string): Promise<number> {
    let count = 0
    for (const [key, row] of this.keys) {
      if (row.userId === userId) {
        this.keys.delete(key)
        count++
      }
    }
    return count
  }
}

export class FakeSavedSearchRepository implements SavedSearchRepository {
  private readonly byId = new Map<string, SavedSearch>()
  private nextId = 1

  async listByUser(userId: string): Promise<SavedSearch[]> {
    return [...this.byId.values()].filter((search) => search.userId === userId)
  }

  async findById(id: string): Promise<SavedSearch | null> {
    return this.byId.get(id) ?? null
  }

  async create(search: NewSavedSearch): Promise<SavedSearch> {
    const now = new Date()
    const created: SavedSearch = {
      id: `search-${this.nextId++}`,
      ...search,
      alertFrequency: 'none',
      lastAlertedAt: null,
      createdAt: now,
      updatedAt: now,
    }
    this.byId.set(created.id, created)
    return created
  }

  async delete(id: string): Promise<void> {
    if (!this.byId.has(id)) throw new SavedSearchNotFoundError(id)
    this.byId.delete(id)
  }

  async deleteAllForUser(userId: string): Promise<number> {
    let count = 0
    for (const [id, search] of this.byId) {
      if (search.userId === userId) {
        this.byId.delete(id)
        count++
      }
    }
    return count
  }

  seed(search: SavedSearch): void {
    this.byId.set(search.id, search)
  }
}

export function savedSearchCriteria(): SavedSearchCriteria {
  return {
    channel: 'sale',
    locationLabel: 'Reading',
    location: { lat: 51.45, lng: -0.98 },
    radiusMetres: 1609,
    filters: { bedroomsMin: 2 },
  }
}
