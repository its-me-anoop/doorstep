import type { MetadataRoute } from 'next'

import { AREAS } from '@/lib/areas'
import { createServices } from '@/lib/composition'

const CHANNEL_SLUGS = ['for-sale', 'to-rent'] as const

const STATIC_PATHS = [
  '/',
  '/sign-in',
  '/sign-up',
  '/privacy',
  '/cookies',
  '/terms',
  '/complaints',
  '/contact',
  '/about',
]

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const baseUrl =
    process.env.NEXT_PUBLIC_APP_URL?.replace(/\/$/, '') ??
    'https://doorstep.local'

  const { listings } = createServices()
  const published = await listings.listPublishedSlugs.execute()

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

  const listingEntries: MetadataRoute.Sitemap = published.map((entry) => ({
    url: `${baseUrl}/property/${entry.slug}`,
    lastModified: entry.lastModified,
    changeFrequency: 'weekly' as const,
    priority: 0.8,
  }))

  return [...staticEntries, ...areaEntries, ...listingEntries]
}
