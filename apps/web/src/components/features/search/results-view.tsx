'use client'

import dynamic from 'next/dynamic'
import { useRouter, useSearchParams } from 'next/navigation'
import {
  useEffect,
  useRef,
  useState,
  useTransition,
  type ReactNode,
} from 'react'

import type { Channel } from '@/domain/enums'
import { ChannelToggle } from '@/components/features/search/channel-toggle'
import { EmptyState } from '@/components/features/search/empty-state'
import { FilterBar } from '@/components/features/search/filter-bar'
import { FilterChips } from '@/components/features/search/filter-chips'
import { computeInitialMapCamera } from '@/components/features/search/map/initial-camera'
import { MapViewToggleButton } from '@/components/features/search/map/map-view-toggle-button'
import { MobileMapTogglePill } from '@/components/features/search/map/mobile-map-toggle-pill'
import { useIsDesktop } from '@/components/features/search/map/use-is-desktop'
import { OutagePanel } from '@/components/features/search/outage-panel'
import { Pagination } from '@/components/features/search/pagination'
import { ResultCard } from '@/components/features/search/result-card'
import { SortSelect } from '@/components/features/search/sort-select'
import { isMapFeatureEnabled } from '@/lib/feature-flags'
import {
  buildSearchHeading,
  type SearchHeadingTier,
} from '@/lib/search-heading'
import { fetchSearchResults } from '@/lib/search-client'
import {
  applyBboxSearch,
  buildSearchApiQuery,
  buildSearchHref,
  parseSearchUrlState,
  type MapBoundingBox,
  type SearchAreaFilter,
  type SearchUrlState,
} from '@/lib/search-url'
import { cn } from '@/lib/utils'
import type { PublicSearchResult } from '@/services/search/search-listings'

/**
 * PRD §7.1: "search list route ships without [the map bundle]." This
 * `dynamic(..., { ssr: false })` boundary is what makes that true in
 * practice — MapView (and everything it imports: the MapLibre/Mapbox
 * adapters, the GL libraries themselves) lives in its own chunk,
 * fetched only once `view=map` actually renders it, never eagerly
 * bundled into this component's own chunk regardless of which route
 * imports `ResultsView`. Declared at module scope (not inside the
 * component) — required for `next/dynamic`'s own preloading to work.
 */
const MapView = dynamic(
  () =>
    import('@/components/features/search/map/map-view').then(
      (mod) => mod.MapView,
    ),
  {
    ssr: false,
    loading: () => (
      <div className="border-border text-muted-foreground flex h-[clamp(480px,75vh,820px)] items-center justify-center rounded-[var(--radius-md)] border text-sm">
        Loading map…
      </div>
    ),
  },
)

interface ResultsViewProps {
  channel: Channel
  /** This route's own unrestricted/search-tier path, e.g. `/for-sale` or
   * `/for-sale/search` — the channel toggle's target and every filter
   * href are built from this. */
  basePath: string
  tier: SearchHeadingTier
  /** The server-rendered first page's real results (SSR, PRD §8.3) —
   * painted immediately, no extra client fetch on mount. `null` when the
   * SSR fetch itself hit the search_unavailable outage (§1.10 point 4) —
   * the outage panel then renders from first paint, same as a
   * client-side re-query failure. */
  initialResult: PublicSearchResult | null
  /** The unfiltered-for-this-tier URL, for the empty state's link. */
  unfilteredHref: string
  /** Unix seconds "now" — threaded down to every ResultCard so the whole
   * grid agrees on one New-this-week instant (§1.11) and so a
   * client-side re-render doesn't quietly redraw badges mid-session. */
  now: number
  /** §4's area landing pages: the curated area's town/outcode, merged
   * into every re-query (not just the SSR initial one) so applying a
   * filter on an area page never silently drops its location scope. */
  areaFilter?: SearchAreaFilter
  /** The curated area's own name, for the `tier === 'area'` heading and
   * the empty state's "see all homes ... in {areaLabel}" copy. */
  areaLabel?: string
  /** The curated area's map default (`lib/areas.ts`'s `centre`/
   * `radiusMiles`, reserved for exactly this since M2) — the map view's
   * initial camera when this is an area landing page with no more
   * specific point/bbox already in the URL. */
  areaCentre?: { lat: number; lng: number }
  areaRadiusMiles?: number
  /** §4.1's intro paragraph + newest-listings strip + CTA — rendered
   * directly after the `<h1>`, before the filter bar. The caller (not
   * this component) decides whether to pass it, since that decision
   * depends on whether any filter is currently active (§4.1: "only
   * present when zero filters are active") and on data (the newest-strip
   * listings) this component has no reason to fetch itself. */
  areaSection?: ReactNode
}

function todayIsoDate(nowSeconds: number): string {
  return new Date(nowSeconds * 1000).toISOString().slice(0, 10)
}

const EMPTY_RESULT: PublicSearchResult = {
  results: [],
  totalCount: 0,
  page: 1,
  totalPages: 1,
  facets: { propertyType: {} },
}

/**
 * ResultsView — the client shell for the results page (§3, §1.10 point
 * 2). Owns the current query as a pure function of the URL
 * (`useSearchParams`, so back/forward is safe for free) and re-queries
 * GET /api/v1/search on every filter/sort/page change via
 * `router.replace` wrapped in `startTransition`; the SSR-provided
 * `initialResult` paints immediately and is never re-fetched just to
 * satisfy mounting.
 */
export function ResultsView({
  channel,
  basePath,
  tier,
  initialResult,
  unfilteredHref,
  now,
  areaFilter,
  areaLabel,
  areaCentre,
  areaRadiusMiles,
  areaSection,
}: ResultsViewProps) {
  const router = useRouter()
  const searchParams = useSearchParams()
  const state = parseSearchUrlState(searchParams)
  const searchKey = searchParams.toString()

  // M3-DESIGN-SPEC.md §0 / PRD §8.8: a kill switch, not a build-time
  // branch — `state.view` is only ever honoured when the flag is on, so
  // disabling it also stops an old shared `?view=map` link from
  // mounting a misbehaving map, not just hiding the discovery toggle.
  const mapFeatureEnabled = isMapFeatureEnabled()
  const isMapView = mapFeatureEnabled && state.view === 'map'
  // §2 vs §3.1: the compact `[ Map ]`/`[ List ]` toggle lives in the
  // desktop sort/count row; mobile's entire toggle mechanism is the
  // floating pill instead (never both at once) — a JS breakpoint check
  // (not `hidden lg:*` alone), same reasoning as map-view.tsx's own
  // `useIsDesktop` doc comment.
  const isDesktop = useIsDesktop()

  const [result, setResult] = useState(initialResult ?? EMPTY_RESULT)
  const [outage, setOutage] = useState(initialResult === null)
  const [isFetching, setIsFetching] = useState(false)
  const [, startTransition] = useTransition()
  const isFirstEffect = useRef(true)

  useEffect(() => {
    if (isFirstEffect.current) {
      isFirstEffect.current = false
      return
    }

    let cancelled = false
    setIsFetching(true)
    fetchSearchResults(buildSearchApiQuery(state, channel, areaFilter))
      .then((data) => {
        if (cancelled) return
        setResult(data)
        setOutage(false)
      })
      .catch((error: unknown) => {
        if (cancelled) return
        // Every failure this surface can hit is the search_unavailable
        // 503 (search-listings.ts wraps any Meilisearch failure in
        // SearchUnavailableError) — no other error UI is specced for
        // this route, so any thrown error renders the same outage panel
        // rather than leaving stale results silently in place.
        void error
        setOutage(true)
      })
      .finally(() => {
        if (!cancelled) setIsFetching(false)
      })

    return () => {
      cancelled = true
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- keyed on the serialised query string, not `state`/`channel` object identity, so this only re-fires when the URL actually changes.
  }, [searchKey])

  function navigate(next: SearchUrlState) {
    const href = buildSearchHref(basePath, next)
    startTransition(() => {
      router.replace(href)
    })
  }

  function handleFilterChange(next: SearchUrlState) {
    navigate({ ...next, page: undefined })
  }

  function handlePageChange(page: number) {
    navigate({ ...state, page })
  }

  // §1.9: "View toggling does not reset page" — a lens change, not a new
  // query, so this goes through the raw `navigate()` (not
  // `handleFilterChange`'s page-resetting variant).
  function handleToggleMapView() {
    navigate({ ...state, view: isMapView ? undefined : 'map' })
  }

  // §1.5: replaces lat/lng/radius with the bbox and resets page — the
  // map's own requery decision (manual "Search this area" or
  // auto-mode's debounce) lands here as a plain URL navigation, which is
  // exactly what re-triggers the fetch effect above (`searchKey`) — no
  // second query path for the map to drift out of sync through.
  function handleBboxSearch(bbox: MapBoundingBox) {
    navigate(applyBboxSearch(state, bbox))
  }

  function retry() {
    setOutage(false)
    let cancelled = false
    setIsFetching(true)
    fetchSearchResults(buildSearchApiQuery(state, channel, areaFilter))
      .then((data) => {
        setResult(data)
        setOutage(false)
      })
      .catch(() => {
        if (!cancelled) setOutage(true)
      })
      .finally(() => {
        if (!cancelled) setIsFetching(false)
      })
    return () => {
      cancelled = true
    }
  }

  const heading = buildSearchHeading({ channel, state, tier, areaLabel })
  const dimmed = isFetching
  const emptyStateAreaLabel =
    tier === 'area' && areaLabel
      ? areaLabel
      : (state.label ?? 'Reading & the Thames Valley')

  // §1.5: "the result count line gains a trailing qualifier while a bbox
  // is active... '248 homes in this area' instead of the bare '248
  // homes'" — the honest-copy rule that keeps the page's identity from
  // churning on a bbox requery.
  const hasActiveBbox =
    state.bboxNeLat !== undefined &&
    state.bboxNeLng !== undefined &&
    state.bboxSwLat !== undefined &&
    state.bboxSwLng !== undefined
  const listHref = buildSearchHref(basePath, { ...state, view: undefined })
  const mapArea =
    areaCentre && areaRadiusMiles !== undefined
      ? { centre: areaCentre, radiusMiles: areaRadiusMiles }
      : undefined
  const initialMapCamera = computeInitialMapCamera(state, mapArea)

  return (
    <div className="flex flex-col">
      {/* §3.2: everything above the grid/pagination hides on mobile
          while map view is active (replaced by the full-screen map) —
          but stays exactly as M2 shipped it on desktop, §2. */}
      <div className={cn(isMapView && 'hidden lg:block')}>
        <ChannelToggle
          channel={channel}
          state={state}
          basePath={basePath}
          className="mb-4"
        />

        <h1 className="text-foreground text-[length:var(--text-h2)] leading-[1.1]">
          {heading}
        </h1>

        {areaSection}

        <div id="listings" className="mt-6">
          <FilterBar
            channel={channel}
            state={state}
            onChange={handleFilterChange}
            today={todayIsoDate(now)}
          />
        </div>

        <FilterChips
          state={state}
          channel={channel}
          onChange={handleFilterChange}
        />

        <div className="mt-6 flex items-center justify-between gap-4">
          <p
            aria-live="polite"
            className="text-muted-foreground flex items-center gap-3 text-base"
          >
            <span>
              {result.totalCount} {result.totalCount === 1 ? 'home' : 'homes'}
              {hasActiveBbox ? ' in this area' : ''}
            </span>
            {dimmed && (
              <span aria-live="polite" className="text-sm">
                Updating results…
              </span>
            )}
          </p>
          <div className="flex items-center gap-3">
            {mapFeatureEnabled && isDesktop && (
              <MapViewToggleButton
                isMapView={isMapView}
                onClick={handleToggleMapView}
              />
            )}
            <SortSelect
              value={state.sort}
              onChange={(sort) => handleFilterChange({ ...state, sort })}
            />
          </div>
        </div>
      </div>

      {isMapView ? (
        <div className="mt-6">
          <MapView
            channel={channel}
            hits={result.results}
            now={now}
            outage={outage}
            dimmed={dimmed}
            onRetry={retry}
            unfilteredHref={unfilteredHref}
            areaLabel={emptyStateAreaLabel}
            listHref={listHref}
            totalCount={result.totalCount}
            initialCamera={initialMapCamera}
            onBboxSearch={handleBboxSearch}
          />
        </div>
      ) : (
        <>
          <div className="mt-6">
            {outage ? (
              <OutagePanel onRetry={retry} />
            ) : result.results.length === 0 ? (
              <EmptyState
                unfilteredHref={unfilteredHref}
                areaLabel={emptyStateAreaLabel}
                channel={channel}
              />
            ) : (
              <div
                className={cn(
                  'opacity-transition grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3 lg:gap-x-8 lg:gap-y-6',
                  dimmed && 'pointer-events-none opacity-70',
                )}
              >
                {result.results.map((hit) => (
                  <ResultCard key={hit.id} hit={hit} now={now} />
                ))}
              </div>
            )}
          </div>

          {mapFeatureEnabled && !isDesktop && (
            <MobileMapTogglePill onClick={handleToggleMapView} />
          )}
        </>
      )}

      {!isMapView && !outage && result.results.length > 0 && (
        <div className="mt-8">
          <Pagination
            page={result.page}
            totalPages={result.totalPages}
            hrefForPage={(page) =>
              buildSearchHref(basePath, { ...state, page })
            }
            onSelect={handlePageChange}
          />
        </div>
      )}
    </div>
  )
}
