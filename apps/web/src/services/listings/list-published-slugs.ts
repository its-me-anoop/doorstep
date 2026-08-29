/**
 * ListPublishedSlugs — sitemap generation (M6 SEO). Walks published
 * listings newest-first via ListingReader.listIndexable, filtering to
 * status === 'published' only (under_offer excluded per PRD sitemap note).
 */

import type { ListingReader } from '@/ports/listing-repository'

export interface PublishedSlugEntry {
  slug: string
  lastModified: Date
}

export class ListPublishedSlugs {
  constructor(private readonly listingReader: ListingReader) {}

  async execute(): Promise<PublishedSlugEntry[]> {
    const entries: PublishedSlugEntry[] = []
    let cursor: string | null = null

    do {
      const page = await this.listingReader.listIndexable({
        cursor,
        limit: 100,
      })

      for (const listing of page.data) {
        if (listing.status !== 'published') continue
        entries.push({
          slug: listing.slug,
          lastModified:
            listing.statusChangedAt ?? listing.publishedAt ?? listing.createdAt,
        })
      }

      cursor = page.nextCursor
    } while (cursor)

    return entries
  }
}
