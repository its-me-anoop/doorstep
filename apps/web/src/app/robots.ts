import type { MetadataRoute } from 'next'

export default function robots(): MetadataRoute.Robots {
  const baseUrl =
    process.env.NEXT_PUBLIC_APP_URL?.replace(/\/$/, '') ??
    'https://doorstep.local'

  return {
    rules: {
      userAgent: '*',
      allow: '/',
      disallow: ['/account', '/lister', '/admin', '/api/'],
    },
    sitemap: `${baseUrl}/sitemap.xml`,
  }
}
