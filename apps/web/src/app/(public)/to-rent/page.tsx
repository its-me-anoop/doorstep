import type { Metadata } from 'next'

import { SearchResultsPage } from '@/components/features/search/search-results-page'

export const metadata: Metadata = {
  title: 'Homes to rent in Reading & the Thames Valley',
}

interface ToRentPageProps {
  searchParams: Promise<Record<string, string | string[] | undefined>>
}

/**
 * `/to-rent` — the unrestricted-tier rent results route
 * (M2-DESIGN-SPEC.md §1.7). No location filter at all.
 */
export default async function ToRentPage({ searchParams }: ToRentPageProps) {
  const rawSearchParams = await searchParams
  return (
    <SearchResultsPage
      channel="rent"
      tier="unrestricted"
      rawSearchParams={rawSearchParams}
    />
  )
}
