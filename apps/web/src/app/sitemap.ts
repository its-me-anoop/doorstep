import type { MetadataRoute } from 'next'

import { AREAS } from '@/lib/areas'
import { createServices } from '@/lib/composition'

/**
 * Sitemap is regenerated periodically at request time rather than
 * prerendered at build — listing URLs require Postgres, which is not
 * available (and must not be required) during `next build` in CI or
 * local builds without a live DATABASE_URL. On a DB failure we still
 * emit static + area URLs so crawlers get a usable sitemap.
 */
export const dynamic = 'force-dynamic'
export const revalidate = 3600

const CHANNEL_SLUGS = ['for-sale', 'to-rent'] as const

const STATIC_PATHS = [
  '/',
  '/sign-in',
  '/sign-up',
  '/privacy',
  '/cookies',
  '/terms',
  '/complaints',
]

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const baseUrl =
    process.env.NEXT_PUBLIC_APP_URL?.replace(/\/$/, '') ??
    'https://doorstep.local'

  const staticEntries: MetadataRoute.Sitemap = STATIC_PATHS.map((path) => ({
    url: `${baseUrl}${path}`,
    changeFrequency: path === '/' ? 'daily' : 'monthly',
    priority: path === '/' ? 1 : 0.5,
  }))

  const areaEntries: MetadataRoute.Sitemap = AREAS.flatMap((area) =>
    CHANNEL_SLUGS.map((channel) => ({
      url: `${baseUrl}/${channel}/${area.slug}`,
      changeFrequency: 'weekly' as const,
      priority: 0.7,
    })),
  )

  let listingEntries: MetadataRoute.Sitemap = []
  try {
    const { listings } = createServices()
    const published = await listings.listPublishedSlugs.execute()
    listingEntries = published.map((entry) => ({
      url: `${baseUrl}/property/${entry.slug}`,
      lastModified: entry.lastModified,
      changeFrequency: 'weekly' as const,
      priority: 0.8,
    }))
  } catch (error) {
    console.error(
      'sitemap: listing URLs unavailable, emitting static+areas only:',
      error,
    )
  }

  return [...staticEntries, ...areaEntries, ...listingEntries]
}
