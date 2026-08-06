import { act, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const replaceMock = vi.fn()
let currentSearch = ''
vi.mock('next/navigation', () => ({
  useRouter: () => ({ replace: replaceMock, push: replaceMock }),
  useSearchParams: () => new URLSearchParams(currentSearch),
}))

const fetchSearchResultsMock = vi.fn()
vi.mock('@/lib/search-client', async () => {
  const actual = await vi.importActual<typeof import('@/lib/search-client')>(
    '@/lib/search-client',
  )
  return {
    ...actual,
    fetchSearchResults: (...args: unknown[]) => fetchSearchResultsMock(...args),
  }
})

import { ResultsView } from '@/components/features/search/results-view'
import { SearchApiError } from '@/lib/search-client'
import type { PublicSearchResult } from '@/services/search/search-listings'

function hit(overrides: Partial<PublicSearchResult['results'][number]> = {}) {
  return {
    id: 'pr_1',
    slug: 'slug-1',
    channel: 'sale' as const,
    title: 'A home',
    displayAddress: 'Oxford Road, Reading',
    town: 'Reading',
    outcode: 'RG30',
    propertyType: 'flat' as const,
    bedrooms: 2,
    bathrooms: 1,
    price: 250000,
    priceQualifier: 'fixed' as const,
    displayStatus: 'published',
    furnished: null,
    availableFrom: null,
    newHome: false,
    coverImageUrl: null,
    imageCount: 0,
    agency: null,
    publishedAt: 0,
    geo: { lat: 51.45, lng: -0.98 },
    ...overrides,
  }
}

function baseResult(
  overrides: Partial<PublicSearchResult> = {},
): PublicSearchResult {
  return {
    results: [hit()],
    totalCount: 1,
    page: 1,
    totalPages: 1,
    facets: { propertyType: {} },
    ...overrides,
  }
}

async function flush() {
  await act(async () => {
    await Promise.resolve()
  })
}

// M2-DESIGN-SPEC.md §1.10/§3 — the results view: SSR seeds the initial
// paint (no extra fetch on mount), filter/sort/page changes re-query via
// the client API and dim the existing grid while pending, and a
// search_unavailable error swaps the grid slot for the outage panel.
describe('ResultsView', () => {
  beforeEach(() => {
    currentSearch = ''
  })

  afterEach(() => {
    replaceMock.mockClear()
    fetchSearchResultsMock.mockClear()
  })

  it('renders the SSR-provided initial results without an extra fetch on mount', () => {
    render(
      <ResultsView
        channel="sale"
        basePath="/for-sale"
        tier="unrestricted"
        initialResult={baseResult()}
        unfilteredHref="/for-sale"
        now={1000}
      />,
    )
    expect(screen.getByText('Oxford Road, Reading')).toBeInTheDocument()
    expect(fetchSearchResultsMock).not.toHaveBeenCalled()
  })

  it('shows the honest result count line', () => {
    render(
      <ResultsView
        channel="sale"
        basePath="/for-sale"
        tier="unrestricted"
        initialResult={baseResult({ totalCount: 248 })}
        unfilteredHref="/for-sale"
        now={1000}
      />,
    )
    expect(screen.getByText('248 homes')).toBeInTheDocument()
  })

  it('applying a filter navigates via router.replace with page reset', () => {
    render(
      <ResultsView
        channel="sale"
        basePath="/for-sale"
        tier="unrestricted"
        initialResult={baseResult()}
        unfilteredHref="/for-sale"
        now={1000}
      />,
    )
    fireEvent.click(screen.getByRole('button', { name: 'Beds' }))
    fireEvent.change(screen.getByLabelText('Min beds'), {
      target: { value: '2' },
    })
    fireEvent.click(screen.getByRole('button', { name: 'Apply' }))

    expect(replaceMock).toHaveBeenCalledTimes(1)
    const href = replaceMock.mock.calls[0][0] as string
    expect(href).toContain('minBeds=2')
    expect(href).not.toContain('page=')
  })

  it('renders the search_unavailable outage panel when the re-query fails, keeping the filter bar interactive', async () => {
    fetchSearchResultsMock.mockRejectedValue(
      new SearchApiError('search_unavailable', 'nope'),
    )
    const { rerender } = render(
      <ResultsView
        channel="sale"
        basePath="/for-sale"
        tier="unrestricted"
        initialResult={baseResult()}
        unfilteredHref="/for-sale"
        now={1000}
      />,
    )
    currentSearch = 'minBeds=2'
    rerender(
      <ResultsView
        channel="sale"
        basePath="/for-sale"
        tier="unrestricted"
        initialResult={baseResult()}
        unfilteredHref="/for-sale"
        now={1000}
      />,
    )
    await flush()

    expect(screen.getByText('Search’s taking a breather.')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Price' })).toBeInTheDocument()
  })

  it('renders the outage panel from first paint when the SSR fetch itself failed (initialResult null)', () => {
    render(
      <ResultsView
        channel="sale"
        basePath="/for-sale"
        tier="unrestricted"
        initialResult={null}
        unfilteredHref="/for-sale"
        now={1000}
      />,
    )
    expect(screen.getByText('Search’s taking a breather.')).toBeInTheDocument()
  })

  it('shows the empty state when a re-query returns zero results', async () => {
    fetchSearchResultsMock.mockResolvedValue(
      baseResult({ results: [], totalCount: 0 }),
    )
    const { rerender } = render(
      <ResultsView
        channel="sale"
        basePath="/for-sale"
        tier="unrestricted"
        initialResult={baseResult()}
        unfilteredHref="/for-sale"
        now={1000}
      />,
    )
    currentSearch = 'minBeds=6'
    rerender(
      <ResultsView
        channel="sale"
        basePath="/for-sale"
        tier="unrestricted"
        initialResult={baseResult()}
        unfilteredHref="/for-sale"
        now={1000}
      />,
    )
    await flush()

    expect(
      screen.getByText('Nothing matches those filters yet.'),
    ).toBeInTheDocument()
  })
})
