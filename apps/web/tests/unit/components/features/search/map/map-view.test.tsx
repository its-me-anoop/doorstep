import { act, fireEvent, render, screen } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'

type Handler = (arg: unknown) => void

const { adapterState, createMapAdapterMock, isDesktopMock } = vi.hoisted(() => {
  const adapterState = {
    handlers: {
      select: [] as Handler[],
      moveend: [] as Handler[],
      tilesFailed: [] as Handler[],
    },
    init: vi.fn(),
    setData: vi.fn(),
    setHighlightedHit: vi.fn(),
    openPopup: vi.fn(),
    closePopup: vi.fn(),
    flyTo: vi.fn(),
    jumpTo: vi.fn(),
    destroy: vi.fn(),
  }
  const fakeAdapter = {
    init: adapterState.init,
    setData: adapterState.setData,
    on: vi.fn(
      (event: 'select' | 'moveend' | 'tilesFailed', handler: Handler) => {
        adapterState.handlers[event].push(handler)
        return () => {
          adapterState.handlers[event] = adapterState.handlers[event].filter(
            (h) => h !== handler,
          )
        }
      },
    ),
    setHighlightedHit: adapterState.setHighlightedHit,
    openPopup: adapterState.openPopup,
    closePopup: adapterState.closePopup,
    flyTo: adapterState.flyTo,
    jumpTo: adapterState.jumpTo,
    destroy: adapterState.destroy,
  }
  return {
    adapterState,
    createMapAdapterMock: vi.fn(() => Promise.resolve(fakeAdapter)),
    isDesktopMock: vi.fn(() => true),
  }
})

vi.mock('@/components/features/search/map/create-map-adapter', () => ({
  createMapAdapter: createMapAdapterMock,
}))
vi.mock('@/components/features/search/map/use-is-desktop', () => ({
  useIsDesktop: isDesktopMock,
}))

import { MapView } from '@/components/features/search/map/map-view'
import type { PublicSearchHit } from '@/services/search/search-listings'

function hit(overrides: Partial<PublicSearchHit> = {}): PublicSearchHit {
  return {
    id: 'pr_1',
    slug: 'oxford-road-flat',
    channel: 'sale',
    title: 'A flat',
    displayAddress: 'Oxford Road, Reading',
    town: 'Reading',
    outcode: 'RG30',
    propertyType: 'flat',
    bedrooms: 2,
    bathrooms: 1,
    price: 250_000,
    priceQualifier: 'fixed',
    displayStatus: 'published',
    furnished: null,
    availableFrom: null,
    newHome: false,
    coverImageUrl: null,
    imageCount: 0,
    agency: null,
    publishedAt: 0,
    geo: { lat: 51.454, lng: -0.9788 },
    ...overrides,
  }
}

function baseProps(
  overrides: Partial<React.ComponentProps<typeof MapView>> = {},
) {
  return {
    channel: 'sale' as const,
    // Same single hit on both sides by default — most tests below don't
    // care about the list/map split itself, only about the seam it
    // replaced (a single `hits` prop). The tests that *do* care
    // (pagination, an off-list-page pin) override one or the other
    // explicitly.
    mapHits: [hit()] as PublicSearchHit[] | null,
    listHits: [hit()],
    listPage: 1,
    listTotalPages: 1,
    onListPageChange: vi.fn(),
    listHrefForPage: (page: number) => `/for-sale?page=${page}`,
    now: 1000,
    outage: false,
    dimmed: false,
    onRetry: vi.fn(),
    unfilteredHref: '/for-sale',
    areaLabel: 'Reading & the Thames Valley',
    listHref: '/for-sale?view=list',
    totalCount: 1,
    initialCamera: { center: [-0.9788, 51.454] as [number, number], zoom: 12 },
    onBboxSearch: vi.fn(),
    ...overrides,
  }
}

async function flush() {
  await act(async () => {
    await Promise.resolve()
    await Promise.resolve()
  })
}

// M3-DESIGN-SPEC.md §2/§3 — the map view orchestrator. The real map
// library is mocked entirely at the `MapAdapter` seam (createMapAdapter),
// per this milestone's own test strategy.
describe('MapView', () => {
  beforeEach(() => {
    // Explicit, not just `afterEach(() => vi.clearAllMocks())`: RTL's own
    // auto-cleanup-after-each (unmounting the *previous* test's tree,
    // which itself calls `adapterState.destroy` once) and this file's
    // `afterEach` race on ordering across the two independently
    // registered hooks — clearing here, at the start of every test
    // instead, guarantees a clean slate regardless of that ordering.
    createMapAdapterMock.mockClear()
    adapterState.init.mockClear()
    adapterState.setData.mockClear()
    adapterState.setHighlightedHit.mockClear()
    adapterState.openPopup.mockClear()
    adapterState.closePopup.mockClear()
    adapterState.destroy.mockClear()
    adapterState.handlers.select = []
    adapterState.handlers.moveend = []
    adapterState.handlers.tilesFailed = []
    isDesktopMock.mockReturnValue(true)
  })

  it('initialises the adapter with the given camera and syncs hits as GeoJSON', async () => {
    render(<MapView {...baseProps()} />)
    await flush()

    expect(createMapAdapterMock).toHaveBeenCalledTimes(1)
    expect(adapterState.init).toHaveBeenCalledWith(expect.any(HTMLDivElement), {
      center: [-0.9788, 51.454],
      zoom: 12,
    })
    expect(adapterState.setData).toHaveBeenCalledWith(
      expect.objectContaining({
        type: 'FeatureCollection',
        features: expect.arrayContaining([
          expect.objectContaining({
            properties: expect.objectContaining({ hitId: 'pr_1' }),
          }),
        ]),
      }),
    )
  })

  it('renders a list column card per hit on desktop', async () => {
    render(<MapView {...baseProps()} />)
    await flush()
    expect(screen.getByText('Oxford Road, Reading')).toBeInTheDocument()
  })

  // e2e hook (tests/e2e/m3.parity.spec.ts): the map has no accessible,
  // real DOM per-pin representation to read ids back from (pins are
  // aria-hidden HTML markers outside the React tree, §4) — this
  // `data-listing-ids` attribute on the map view's own root is the one
  // stable, structural way an outside test can read "what listing set is
  // this map currently backed by" without driving a real cluster-expand
  // gesture. Slugs, not ids: the same public identifier
  // `a[href="/property/{slug}"]` already exposes in the list grid
  // (result-card.tsx), so a parity test can compare the two sets
  // directly with no id/slug translation step of its own.
  it('exposes the current *map* hits as slugs on the map view root (data-listing-ids), for e2e parity checks — independent of the list column’s own page', async () => {
    render(
      <MapView
        {...baseProps({
          mapHits: [
            hit({ id: 'pr_1', slug: 'oxford-road-flat' }),
            hit({
              id: 'pr_2',
              slug: 'kings-road-house',
              geo: { lat: 51.47, lng: -0.96 },
            }),
          ],
        })}
      />,
    )
    await flush()

    const root = screen.getByTestId('map-view')
    expect(JSON.parse(root.getAttribute('data-listing-ids') ?? '[]')).toEqual([
      'oxford-road-flat',
      'kings-road-house',
    ])
  })

  it('clears data-listing-ids during an outage, matching the pin-less map (§1.8)', async () => {
    render(<MapView {...baseProps({ outage: true })} />)
    await flush()
    expect(screen.getByTestId('map-view')).toHaveAttribute(
      'data-listing-ids',
      '[]',
    )
  })

  it('shows the outage panel in the list column and clears map pins during an outage', async () => {
    const onRetry = vi.fn()
    render(<MapView {...baseProps({ outage: true, onRetry })} />)
    await flush()

    expect(screen.getByText('Search’s taking a breather.')).toBeInTheDocument()
    expect(adapterState.setData).toHaveBeenCalledWith({
      type: 'FeatureCollection',
      features: [],
    })
    fireEvent.click(screen.getByRole('button', { name: 'Try again' }))
    expect(onRetry).toHaveBeenCalledTimes(1)
  })

  it('shows the "nothing in view" message in the list column for a genuinely empty viewport', async () => {
    render(<MapView {...baseProps({ listHits: [], mapHits: [] })} />)
    await flush()
    expect(screen.getByText('Nothing in view right now.')).toBeInTheDocument()
  })

  // §1.3: "the map is never quietly capped to the list's current page...
  // A pin's mini card can therefore link to a listing not on the list's
  // current page; that's an accepted, intentional asymmetry, not a bug."
  it('shows the list column empty message while the map itself still has pins beyond that page (§1.3’s intentional asymmetry)', async () => {
    render(<MapView {...baseProps({ listHits: [] })} />)
    await flush()
    // The map's own data still reflects the full mapHits set (the
    // default single hit) — only the desktop *list column* is empty.
    expect(screen.getByText('Nothing in view right now.')).toBeInTheDocument()
    expect(adapterState.setData).toHaveBeenCalledWith(
      expect.objectContaining({
        features: expect.arrayContaining([
          expect.objectContaining({
            properties: expect.objectContaining({ hitId: 'pr_1' }),
          }),
        ]),
      }),
    )
  })

  it('opens a real map popup for a pin whose hit is not on the list column’s current page — the mini card reads from mapHits, not listHits', async () => {
    isDesktopMock.mockReturnValue(true)
    render(
      <MapView
        {...baseProps({
          listHits: [hit({ id: 'pr_1', slug: 'oxford-road-flat' })],
          mapHits: [
            hit({ id: 'pr_1', slug: 'oxford-road-flat' }),
            hit({
              id: 'pr_2',
              slug: 'kings-road-house',
              displayAddress: 'Kings Road, Reading',
              geo: { lat: 51.47, lng: -0.96 },
            }),
          ],
        })}
      />,
    )
    await flush()

    act(() => {
      // pr_2 is only ever in mapHits — never in this render's listHits.
      adapterState.handlers.select.forEach((h) => h('pr_2'))
    })
    await flush()

    expect(adapterState.openPopup).toHaveBeenCalledWith(
      [-0.96, 51.47],
      expect.any(HTMLElement),
    )
  })

  // Client-only fetch (map-hits has no SSR equivalent — results-view.tsx's
  // own doc comment) — `null` means "hasn't resolved yet," distinct from
  // `[]` ("resolved, genuinely zero"), so a direct `?view=map` load never
  // flashes "Nothing in view right now." before the first response
  // arrives.
  it('does not show the mobile "nothing in view" overlay while mapHits is still null (loading), only once it resolves to genuinely empty', async () => {
    isDesktopMock.mockReturnValue(false)
    const { rerender } = render(
      <MapView {...baseProps({ mapHits: null, outage: false })} />,
    )
    await flush()
    expect(
      screen.queryByText('Nothing in view right now.'),
    ).not.toBeInTheDocument()

    rerender(<MapView {...baseProps({ mapHits: [], outage: false })} />)
    await flush()
    expect(screen.getByText('Nothing in view right now.')).toBeInTheDocument()
  })

  it('renders Pagination in the desktop list column, driven by the list props (not the map’s own up-to-200 set)', async () => {
    const onListPageChange = vi.fn()
    render(
      <MapView
        {...baseProps({
          listPage: 2,
          listTotalPages: 5,
          onListPageChange,
          listHrefForPage: (page) => `/for-sale?page=${page}`,
        })}
      />,
    )
    await flush()

    const nav = screen.getByRole('navigation', { name: 'Search results pages' })
    expect(nav).toBeInTheDocument()
    expect(screen.getByRole('link', { name: '3' })).toHaveAttribute(
      'href',
      '/for-sale?page=3',
    )
    fireEvent.click(screen.getByRole('link', { name: '3' }))
    expect(onListPageChange).toHaveBeenCalledWith(3)
  })

  it('does not render Pagination in the list column when there is only one page', async () => {
    render(<MapView {...baseProps({ listPage: 1, listTotalPages: 1 })} />)
    await flush()
    expect(
      screen.queryByRole('navigation', { name: 'Search results pages' }),
    ).not.toBeInTheDocument()
  })

  it('opens a real map popup (not the docked JSX panel) when a pin is selected on desktop', async () => {
    isDesktopMock.mockReturnValue(true)
    render(<MapView {...baseProps()} />)
    await flush()

    act(() => {
      adapterState.handlers.select.forEach((h) => h('pr_1'))
    })
    await flush()

    expect(adapterState.openPopup).toHaveBeenCalledWith(
      [-0.9788, 51.454],
      expect.any(HTMLElement),
    )
    // The docked bottom panel is the mobile mechanism — not rendered here.
    expect(
      document.querySelector('.fixed.inset-x-0.bottom-0 .mini-card'),
    ).toBeNull()
  })

  it('renders the docked mini card panel (not a popup) when a pin is selected on mobile', async () => {
    isDesktopMock.mockReturnValue(false)
    render(<MapView {...baseProps()} />)
    await flush()

    act(() => {
      adapterState.handlers.select.forEach((h) => h('pr_1'))
    })
    await flush()

    expect(
      screen.getByRole('group', { name: /Oxford Road, Reading/ }),
    ).toBeInTheDocument()
    expect(adapterState.openPopup).not.toHaveBeenCalled()

    fireEvent.click(screen.getByRole('button', { name: 'Close' }))
    expect(
      screen.queryByRole('group', { name: /Oxford Road, Reading/ }),
    ).not.toBeInTheDocument()
  })

  it('shows "Search this area" after a moveend, and requeries on click', async () => {
    const onBboxSearch = vi.fn()
    render(<MapView {...baseProps({ onBboxSearch })} />)
    await flush()

    expect(
      screen.queryByRole('button', { name: 'Search this area' }),
    ).not.toBeInTheDocument()

    const bbox = { neLat: 51.5, neLng: -0.9, swLat: 51.4, swLng: -1.0 }
    act(() => {
      adapterState.handlers.moveend.forEach((h) => h(bbox))
    })

    const button = screen.getByRole('button', { name: 'Search this area' })
    fireEvent.click(button)
    expect(onBboxSearch).toHaveBeenCalledWith(bbox)
    expect(
      screen.queryByRole('button', { name: 'Search this area' }),
    ).not.toBeInTheDocument()
  })

  it('renders the "Search as I move the map" checkbox, off by default', async () => {
    render(<MapView {...baseProps()} />)
    await flush()
    const checkbox = screen.getByRole('checkbox', {
      name: 'Search as I move the map',
    })
    expect(checkbox).not.toBeChecked()
    fireEvent.click(checkbox)
    expect(checkbox).toBeChecked()
  })

  it('shows the tiles-failed overlay, on every viewport, when the adapter reports one', async () => {
    render(<MapView {...baseProps()} />)
    await flush()

    act(() => {
      adapterState.handlers.tilesFailed.forEach((h) => h(undefined))
    })

    expect(
      screen.getByText('Map tiles aren’t loading right now.'),
    ).toBeInTheDocument()
    expect(
      screen.getByRole('link', { name: 'View as a list' }),
    ).toHaveAttribute('href', '/for-sale?view=list')
  })

  it('renders the mobile "List (N)" pill with the live total count', async () => {
    isDesktopMock.mockReturnValue(false)
    render(<MapView {...baseProps({ totalCount: 248 })} />)
    await flush()
    expect(screen.getByRole('link', { name: 'List (248)' })).toHaveAttribute(
      'href',
      '/for-sale?view=list',
    )
  })

  it('hides the "List (N)" pill while a mini card is open', async () => {
    isDesktopMock.mockReturnValue(false)
    render(<MapView {...baseProps()} />)
    await flush()

    act(() => {
      adapterState.handlers.select.forEach((h) => h('pr_1'))
    })
    await flush()

    expect(
      screen.queryByRole('link', { name: /^List \(/ }),
    ).not.toBeInTheDocument()
  })

  it('destroys the adapter on unmount', async () => {
    const { unmount } = render(<MapView {...baseProps()} />)
    await flush()
    unmount()
    expect(adapterState.destroy).toHaveBeenCalledTimes(1)
  })
})
