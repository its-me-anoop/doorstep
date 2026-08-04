/**
 * SearchIndex — the projection Meilisearch adapters write to and the
 * search service reads from. Postgres stays the source of truth; this
 * port models Meilisearch as a disposable, rebuildable index. See PRD
 * §8.6.
 */

export interface GeoPoint {
  lat: number
  lng: number
}

export interface SearchDocument {
  id: string
  channel: 'sale' | 'rent'
  title: string
  displayAddress: string
  town: string
  outcode: string
  propertyType: string
  bedrooms: number
  bathrooms: number
  price: number
  publishedAt: string
  geo: GeoPoint
}

export interface SearchFilters {
  channel?: 'sale' | 'rent'
  minPrice?: number
  maxPrice?: number
  bedrooms?: number
  propertyType?: string
  geoRadius?: { center: GeoPoint; metres: number }
  geoBoundingBox?: { northEast: GeoPoint; southWest: GeoPoint }
}

export interface SearchResult {
  documents: SearchDocument[]
  totalHits: number
}

export interface SearchIndex {
  upsert(document: SearchDocument): Promise<void>
  delete(id: string): Promise<void>
  search(filters: SearchFilters): Promise<SearchResult>
}
