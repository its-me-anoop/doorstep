import type { Metadata } from 'next'

import { SearchResultsPage } from '@/components/features/search/search-results-page'

export const metadata: Metadata = {
  title: 'Homes to rent near you',
}

interface ToRentSearchPageProps {
  searchParams: Promise<Record<string, string | string[] | undefined>>
}

/**
 * `/to-rent/search` — the geocoded-point tier (M2-DESIGN-SPEC.md §1.7).
 */
export default async function ToRentSearchPage({
  searchParams,
}: ToRentSearchPageProps) {
  const rawSearchParams = await searchParams
  return (
    <SearchResultsPage
      channel="rent"
      tier="search"
      rawSearchParams={rawSearchParams}
    />
  )
}
