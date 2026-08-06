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

// M3: MapView itself (marker sync, popups, the real map libraries) is
// exhaustively covered by map-view.test.tsx — this file only needs to
// verify results-view.tsx's own wiring into it (props, the bbox→URL
// handler), so a thin stub stands in for the real (dynamically
// imported) component.
vi.mock('@/components/features/search/map/map-view', () => ({
  MapView: (props: {
    totalCount: number
    onBboxSearch: (bbox: {
      neLat: number
      neLng: number
      swLat: number
      swLng: number
    }) => void
  }) => (
    <div data-testid="map-view" data-total-count={props.totalCount}>
      <button
        onClick={() =>
          props.onBboxSearch({
            neLat: 51.5,
            neLng: -0.9,
            swLat: 51.4,
            swLng: -1.0,
          })
        }
      >
        trigger-bbox-search
      </button>
    </div>
  ),
}))

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

  // §4 area landing pages — ResultsView is reused verbatim for
  // `/for-sale/{area}`, so its own area-specific plumbing lives here
  // rather than a parallel component.
  it('renders the "in {area}" heading and threads the area filter into re-queries', async () => {
    fetchSearchResultsMock.mockResolvedValue(baseResult())
    const { rerender } = render(
      <ResultsView
        channel="sale"
        basePath="/for-sale/reading"
        tier="area"
        areaLabel="Reading"
        areaFilter={{ town: 'Reading' }}
        initialResult={baseResult()}
        unfilteredHref="/for-sale/reading"
        now={1000}
      />,
    )
    expect(screen.getByText('Homes for sale in Reading')).toBeInTheDocument()

    currentSearch = 'minBeds=2'
    rerender(
      <ResultsView
        channel="sale"
        basePath="/for-sale/reading"
        tier="area"
        areaLabel="Reading"
        areaFilter={{ town: 'Reading' }}
        initialResult={baseResult()}
        unfilteredHref="/for-sale/reading"
        now={1000}
      />,
    )
    await flush()

    expect(fetchSearchResultsMock).toHaveBeenCalledWith(
      expect.objectContaining({ town: 'Reading', bedsMin: '2' }),
    )
  })

  it('renders the optional areaSection content directly after the heading', () => {
    render(
      <ResultsView
        channel="sale"
        basePath="/for-sale/reading"
        tier="area"
        areaLabel="Reading"
        areaSection={<p data-testid="area-intro">Reading is lovely.</p>}
        initialResult={baseResult()}
        unfilteredHref="/for-sale/reading"
        now={1000}
      />,
    )
    expect(screen.getByTestId('area-intro')).toBeInTheDocument()
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

  // M3-DESIGN-SPEC.md §2/§0 — the map toggle and its feature flag.
  describe('map view', () => {
    afterEach(() => {
      vi.unstubAllEnvs()
      vi.unstubAllGlobals()
    })

    it('renders the [Map] toggle by default (flag enabled) and navigates to view=map on click', () => {
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
      fireEvent.click(screen.getByRole('button', { name: 'Map' }))
      expect(replaceMock).toHaveBeenCalledTimes(1)
      const href = replaceMock.mock.calls[0][0] as string
      expect(href).toContain('view=map')
    })

    it('hides the toggle entirely when the feature flag is off (kill switch)', () => {
      vi.stubEnv('NEXT_PUBLIC_FEATURE_MAP', 'false')
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
      expect(
        screen.queryByRole('button', { name: 'Map' }),
      ).not.toBeInTheDocument()
    })

    it('renders the normal grid, not the map, when the flag is off even if view=map is in the URL', async () => {
      vi.stubEnv('NEXT_PUBLIC_FEATURE_MAP', 'false')
      currentSearch = 'view=map'
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
      await flush()
      expect(screen.queryByTestId('map-view')).not.toBeInTheDocument()
      expect(screen.getByText('Oxford Road, Reading')).toBeInTheDocument()
    })

    it('renders MapView (not the grid) once view=map is active, and hides the desktop chrome only on mobile widths', async () => {
      // jsdom has no real `matchMedia` implementation by default, which
      // `useIsDesktop` treats as "not desktop" — stub it to exercise the
      // desktop-only compact toggle button this test is actually about.
      vi.stubGlobal('matchMedia', () => ({
        matches: true,
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
      }))
      currentSearch = 'view=map'
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
      await flush()
      const mapView = screen.getByTestId('map-view')
      expect(mapView).toHaveAttribute('data-total-count', '248')
      // The toggle button relabels to "List" and is aria-pressed while active.
      expect(screen.getByRole('button', { name: 'List' })).toHaveAttribute(
        'aria-pressed',
        'true',
      )
    })

    it("wires the map's bbox requery into a URL navigation via applyBboxSearch, resetting page", async () => {
      currentSearch = 'view=map&page=3&minBeds=2'
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
      await flush()
      fireEvent.click(screen.getByText('trigger-bbox-search'))

      expect(replaceMock).toHaveBeenCalledTimes(1)
      const href = replaceMock.mock.calls[0][0] as string
      expect(href).toContain('bboxNeLat=51.5')
      expect(href).toContain('minBeds=2')
      expect(href).not.toContain('page=')
    })

    it('shows the "in this area" qualifier on the count line once a bbox is active', () => {
      currentSearch =
        'view=map&bboxNeLat=51.5&bboxNeLng=-0.9&bboxSwLat=51.4&bboxSwLng=-1'
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
      expect(screen.getByText('248 homes in this area')).toBeInTheDocument()
    })
  })
})
