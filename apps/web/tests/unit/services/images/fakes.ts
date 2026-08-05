/**
 * In-memory fake for services/images/*'s TDD suite (PRD §8.5) — same
 * shape and reasoning as tests/unit/services/listings/fakes.ts's
 * FakeListingRepository. FakeListingRepository itself is reused directly
 * (not duplicated) from that file for the ListingReader half every
 * images service also needs for object-level authz.
 */

import {
  PropertyImageNotFoundError,
  type NewPropertyImage,
  type PropertyImage,
  type PropertyImageReader,
  type PropertyImageWriter,
} from '@/ports/property-image-repository'
import type { ImageKind } from '@/domain/enums'

export class FakePropertyImageRepository
  implements PropertyImageReader, PropertyImageWriter
{
  private readonly byId = new Map<string, PropertyImage>()

  async findById(id: string): Promise<PropertyImage | null> {
    return this.byId.get(id) ?? null
  }

  async listByProperty(propertyId: string): Promise<PropertyImage[]> {
    return [...this.byId.values()]
      .filter((image) => image.propertyId === propertyId)
      .sort((a, b) => a.position - b.position)
  }

  async countByProperty(propertyId: string): Promise<number> {
    return [...this.byId.values()].filter(
      (image) => image.propertyId === propertyId,
    ).length
  }

  async create(image: NewPropertyImage): Promise<PropertyImage> {
    const now = new Date()
    const created: PropertyImage = { ...image, createdAt: now, updatedAt: now }
    this.byId.set(image.id, created)
    return created
  }

  async updatePosition(id: string, position: number): Promise<PropertyImage> {
    return this.applyChanges(id, { position })
  }

  async updateKind(id: string, kind: ImageKind): Promise<PropertyImage> {
    return this.applyChanges(id, { kind })
  }

  async delete(id: string): Promise<void> {
    this.byId.delete(id)
  }

  /** Test helper: seed an image directly, bypassing create(). */
  seed(image: PropertyImage): void {
    this.byId.set(image.id, image)
  }

  private applyChanges(
    id: string,
    changes: Partial<Pick<PropertyImage, 'position' | 'kind'>>,
  ): PropertyImage {
    const existing = this.byId.get(id)
    if (!existing) throw new PropertyImageNotFoundError(id)
    const updated: PropertyImage = {
      ...existing,
      ...changes,
      updatedAt: new Date(),
    }
    this.byId.set(id, updated)
    return updated
  }
}
