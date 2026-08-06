import type { Metadata } from 'next'

import { SearchResultsPage } from '@/components/features/search/search-results-page'

export const metadata: Metadata = {
  title: 'Homes for sale in Reading & the Thames Valley',
}

interface ForSalePageProps {
  searchParams: Promise<Record<string, string | string[] | undefined>>
}

/**
 * `/for-sale` — the unrestricted-tier sale results route
 * (M2-DESIGN-SPEC.md §1.7). No location filter at all: every
 * `published`/`under_offer` sale listing, narrowed only by whatever
 * filters the URL carries.
 */
export default async function ForSalePage({ searchParams }: ForSalePageProps) {
  const rawSearchParams = await searchParams
  return (
    <SearchResultsPage
      channel="sale"
      tier="unrestricted"
      rawSearchParams={rawSearchParams}
    />
  )
}
