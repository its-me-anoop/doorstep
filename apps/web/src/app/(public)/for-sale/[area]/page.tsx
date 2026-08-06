/**
 * `/for-sale/{area}` — a curated area landing page (PRD §6.1 SRCH-7,
 * M2-DESIGN-SPEC.md §4). The exact same results-page shell as
 * `/for-sale` and `/for-sale/search` (SearchResultsPage), scoped to one
 * of `lib/areas.ts`'s curated areas via its own `area` prop, per §4's
 * "an area page *is* the results page for that area with zero
 * additional filters applied."
 *
 * **Rendering, corrected from an earlier, disproven claim:** PRD §8.3
 * asks for this route to be "ISR, revalidated daily or on demand," and an
 * earlier version of this file (plus `docs/ARCHITECTURE.md`) claimed that
 * requirement was met for the canonical, zero-filter URL specifically —
 * `revalidate = 86400` below, `generateStaticParams` pre-generating the
 * seven curated slugs, and `lib/listing-revalidation.ts`'s
 * `revalidatePath` calls targeting this route's bare path on every
 * visibility change. That claim did not hold up against
 * `pnpm build`'s own route table: this page (like `/for-sale` and
 * `/for-sale/search`) also reads `searchParams` — needed to support
 * `/for-sale/reading?minBeds=2`, §4's own "same URL, different filter
 * state" model — and Next's classic (pre-Cache-Components) App Router
 * treats *any* access to `searchParams` as disqualifying the WHOLE route
 * from static generation, not just the specific request that happened to
 * carry query params. The build output shows this route as `ƒ` (fully
 * dynamic), never `●` (SSG/ISR) — every visit, filtered or not, does a
 * live Postgres+Meilisearch round trip.
 *
 * A genuine static-shell-plus-dynamic-filter split exists in Next.js 16
 * as Partial Prerendering, but only behind the `cacheComponents` flag
 * (`next.config.ts`) — an app-wide caching-model migration (route segment
 * configs like this file's old `revalidate` export are replaced
 * end-to-end by `'use cache'`/`cacheLife`) well beyond the scope of a
 * single route. Until that migration happens, full dynamic rendering
 * here is a deliberate, tracked trade-off, not an oversight:
 * `generateStaticParams` is kept (harmless — it still registers the
 * seven valid slugs and costs nothing on a dynamic route), but
 * `revalidate` is removed rather than left in place implying an ISR
 * effect it does not have.
 */

import type { Metadata } from 'next'
import { notFound } from 'next/navigation'

import { SearchResultsPage } from '@/components/features/search/search-results-page'
import { AREAS, findAreaBySlug } from '@/lib/areas'
import { buildSearchHeading } from '@/lib/search-heading'

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
