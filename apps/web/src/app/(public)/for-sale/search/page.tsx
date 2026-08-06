import type { Metadata } from 'next'

import { SearchResultsPage } from '@/components/features/search/search-results-page'

export const metadata: Metadata = {
  title: 'Homes for sale near you',
}

interface ForSaleSearchPageProps {
  searchParams: Promise<Record<string, string | string[] | undefined>>
}

/**
 * `/for-sale/search` — the geocoded-point tier (M2-DESIGN-SPEC.md §1.7):
 * a postcode or free-text place that isn't one of the curated area
 * slugs, carried via `lat`/`lng`/`radius`/`label`.
 */
export default async function ForSaleSearchPage({
  searchParams,
}: ForSaleSearchPageProps) {
  const rawSearchParams = await searchParams
  return (
    <SearchResultsPage
      channel="sale"
      tier="search"
      rawSearchParams={rawSearchParams}
    />
  )
}
