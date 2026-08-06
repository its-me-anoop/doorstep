/**
 * `/for-sale/{area}` — a curated area landing page (PRD §6.1 SRCH-7,
 * M2-DESIGN-SPEC.md §4). The exact same results-page shell as
 * `/for-sale` and `/for-sale/search` (SearchResultsPage), scoped to one
 * of `lib/areas.ts`'s curated areas via its own `area` prop, per §4's
 * "an area page *is* the results page for that area with zero
 * additional filters applied."
 *
 * **ISR / caching, stated precisely rather than overclaimed:** `revalidate`
 * below and `generateStaticParams` are the literal PRD §8.3 mechanism
 * ("ISR, revalidated daily or on demand") and pre-generate the seven
 * curated area paths. The caveat worth being honest about: this route,
 * like `/for-sale` and `/for-sale/search`, also reads `searchParams` (to
 * support `/for-sale/reading?minBeds=2` — §4's own "same URL, different
 * filter state" model), which Next.js treats as a per-request dynamic
 * API — so a *filtered* visit to this route is always freshly rendered,
 * not served from the ISR cache, the same as the unrestricted/search
 * tiers already are. The genuinely cacheable, always-on-demand-revalidated
 * piece is the "Newest in {area}" strip's underlying data
 * (services/listings/list-newest-in-area.ts, a direct Postgres read) —
 * `lib/listing-revalidation.ts`'s `revalidatePath` calls target this
 * route's bare canonical path specifically so that path's cache entry is
 * invalidated the moment a listing in the area changes visibility.
 */

import type { Metadata } from 'next'
import { notFound } from 'next/navigation'

import { SearchResultsPage } from '@/components/features/search/search-results-page'
import { AREAS, findAreaBySlug } from '@/lib/areas'
import { buildSearchHeading } from '@/lib/search-heading'

export const revalidate = 86400

interface ForSaleAreaPageProps {
  params: Promise<{ area: string }>
  searchParams: Promise<Record<string, string | string[] | undefined>>
}

export function generateStaticParams() {
  return AREAS.map((area) => ({ area: area.slug }))
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ area: string }>
}): Promise<Metadata> {
  const { area: slug } = await params
  const area = findAreaBySlug(slug)
  if (!area) return {}

  return {
    title: buildSearchHeading({
      channel: 'sale',
      state: {},
      tier: 'area',
      areaLabel: area.label,
    }),
    description: area.intro,
    alternates: { canonical: `/for-sale/${area.slug}` },
  }
}

export default async function ForSaleAreaPage({
  params,
  searchParams,
}: ForSaleAreaPageProps) {
  const { area: slug } = await params
  const area = findAreaBySlug(slug)
  if (!area) {
    notFound()
    return null
  }

  const rawSearchParams = await searchParams
  return (
    <SearchResultsPage
      channel="sale"
      tier="area"
      rawSearchParams={rawSearchParams}
      area={area}
    />
  )
}
