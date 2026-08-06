/**
 * `/to-rent/{area}` — the rent-channel counterpart of
 * `/for-sale/[area]/page.tsx`; see that file's doc comment for the full
 * rendering-strategy reasoning (identical here, channel aside — this
 * route is fully dynamic for the same `searchParams`-access reason, not
 * ISR, and carries no `revalidate` export for the same reason that one
 * was removed).
 */

import type { Metadata } from 'next'
import { notFound } from 'next/navigation'

import { SearchResultsPage } from '@/components/features/search/search-results-page'
import { AREAS, findAreaBySlug } from '@/lib/areas'
import { buildSearchHeading } from '@/lib/search-heading'

interface ToRentAreaPageProps {
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
      channel: 'rent',
      state: {},
      tier: 'area',
      areaLabel: area.label,
    }),
    description: area.intro,
    alternates: { canonical: `/to-rent/${area.slug}` },
  }
}

export default async function ToRentAreaPage({
  params,
  searchParams,
}: ToRentAreaPageProps) {
  const { area: slug } = await params
  const area = findAreaBySlug(slug)
  if (!area) {
    notFound()
    return null
  }

  const rawSearchParams = await searchParams
  return (
    <SearchResultsPage
      channel="rent"
      tier="area"
      rawSearchParams={rawSearchParams}
      area={area}
    />
  )
}
