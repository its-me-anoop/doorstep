'use client'

import { useEffect, useRef, useState } from 'react'
import { createRoot, type Root } from 'react-dom/client'

import type { Channel } from '@/domain/enums'
import { OutagePanel } from '@/components/features/search/outage-panel'
import { Pagination } from '@/components/features/search/pagination'
import { ResultCard } from '@/components/features/search/result-card'
import type { MapBoundingBox } from '@/lib/search-url'
import { cn } from '@/lib/utils'
import type { PublicSearchHit } from '@/services/search/search-listings'

import { createMapAdapter } from './create-map-adapter'
import { hitsToFeatureCollection } from './geojson'
import type { InitialCamera } from './initial-camera'
import type { MapAdapter } from './map-adapter'
import { MapEmptyMessage, MapOverlay } from './map-overlay'
import { MiniCard } from './mini-card'
import { SearchAsYouMoveControls } from './search-as-you-move-controls'
import { useIsDesktop } from './use-is-desktop'
import { useSearchAsYouMove } from './use-search-as-you-move'

interface MapViewProps {
  channel: Channel
  /** Up to `MAX_HITS_PER_PAGE` matching hits for the *current query*,
   * fetched independently of the list column's own 24/page window
   * (results-view.tsx's own separate `buildMapSearchApiQuery` fetch —
   * see geojson.ts's doc comment for why parity with the list is still
   * structural despite this). Backs the pins/clusters, the
   * `data-listing-ids` e2e hook, and the selected-pin lookup below — a
   * pin can reference a hit that isn't in `listHits` (§1.3: "a pin's
   * mini card can therefore link to a listing not on the list's current
   * page; that's an accepted, intentional asymmetry, not a bug").
   * `null` while that fetch (client-only; no SSR equivalent exists for
   * this second, larger window) hasn't resolved yet — treated the same
   * as "no pins yet," never as "genuinely zero," so a direct `?view=map`
   * load never flashes an incorrect empty-state message before the
   * first response arrives. */
  mapHits: PublicSearchHit[] | null
  /** The list column's own paginated 24/page slice (M2 §3.7, unchanged
   * mechanics) — results-view.tsx's existing SSR-backed fetch. Only
   * affects the desktop list column (§2.1) and its own `Pagination`
   * below; independent of which hits the map pane itself plots. */
  listHits: PublicSearchHit[]
  /** `listHits`'s own page/total, for the list column's `Pagination`
   * (§2.1: "sits at the bottom of this column, inside its own scroll
   * container — unchanged in mechanics"). */
  listPage: number
  listTotalPages: number
  onListPageChange: (page: number) => void
  listHrefForPage: (page: number) => string
  now: number
  outage: boolean
  dimmed: boolean
  onRetry: () => void
  unfilteredHref: string
  areaLabel: string
  /** The current query with `view` dropped back to list — both the
   * mobile "List (N)" pill and the tiles-failed overlay's "View as a
   * list" link target this. */
  listHref: string
  totalCount: number
  initialCamera: InitialCamera
  /** Fired once per requery decision (`useSearchAsYouMove`'s own
   * contract) — the caller (results-view.tsx) turns this into a URL
   * change via `applyBboxSearch`. */
  onBboxSearch: (bbox: MapBoundingBox) => void
}

/**
 * MapView — M3-DESIGN-SPEC.md §2/§3's map surface: desktop 42/58 split
 * (list column + map pane) and mobile full-screen map, as one component
 * whose layout is almost entirely responsive CSS (`lg:` utilities), not
 * JS breakpoint branching — see `use-is-desktop.ts`'s own doc comment
 * for the one exception (the mini card's mechanism).
 *
 * Only ever reached via `next/dynamic(..., { ssr: false })` from
 * results-view.tsx, activated once `view=map` — this file (and
 * everything it imports: the map adapters, MapLibre/Mapbox themselves)
 * is what "the list route ships without the map bundle" (PRD §7.1)
 * actually means in practice.
 */
export function MapView({
  channel,
  mapHits,
  listHits,
  listPage,
  listTotalPages,
  onListPageChange,
  listHrefForPage,
  now,
  outage,
  dimmed,
  onRetry,
  unfilteredHref,
  areaLabel,
  listHref,
  totalCount,
  initialCamera,
  onBboxSearch,
}: MapViewProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const adapterRef = useRef<MapAdapter | null>(null)
  const isDesktop = useIsDesktop()

  const [selectedHitId, setSelectedHitId] = useState<string | null>(null)
  const [tilesFailed, setTilesFailed] = useState(false)
  // Flips once `createMapAdapter()` resolves and `adapterRef.current` is
  // set — `adapterRef` itself isn't reactive, so the `setData`/
  // `setHighlightedHit` effects below need *some* state in their
  // dependency array to guarantee they run again once the (async)
  // adapter actually exists, even when `mapHits`/`highlightedHitId`
  // themselves haven't changed since the very first render.
  const [adapterReady, setAdapterReady] = useState(false)

  const searchAsYouMove = useSearchAsYouMove({ onRequery: onBboxSearch })

  // §1.3's own intentional asymmetry: a selected pin's hit is looked up
  // in `mapHits` (what the map itself actually plotted), never
  // `listHits` (the list column's own, possibly-narrower page) — a pin
  // can reference a hit that isn't on the list's current page at all.
  const selectedHit =
    (mapHits ?? []).find((hit) => hit.id === selectedHitId) ?? null

  // Mount the map once. `initialCamera` is deliberately read only at
  // mount time (not a dependency) — §5: nothing in this milestone
  // re-centres the camera out from under a user who's already looking
  // at the map, and a later bbox requery only changes pin/list
  // *contents*, never the viewport.
  useEffect(() => {
    let cancelled = false

    createMapAdapter().then((adapter) => {
      if (cancelled || !containerRef.current) {
        adapter.destroy()
        return
      }
      adapterRef.current = adapter
      adapter.init(containerRef.current, initialCamera)
      adapter.on('select', (hitId) => setSelectedHitId(hitId))
      adapter.on('moveend', (bounds) => searchAsYouMove.notifyMoveEnd(bounds))
      adapter.on('tilesFailed', () => setTilesFailed(true))
      setAdapterReady(true)
    })

    return () => {
      cancelled = true
      adapterRef.current?.destroy()
      adapterRef.current = null
      setAdapterReady(false)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- mount-once by design; see the comment above.
  }, [])

  // Keeps the map's pins in lockstep with its own up-to-`MAX_HITS_PER_PAGE`
  // hit set (§1.3) — not the list column's narrower page (see
  // geojson.ts's doc comment for why the two still can't disagree on
  // *which* listings match, only on how many each side's own window
  // returns). Pin-less during an outage (§1.8 point 2: "Base tiles keep
  // rendering... just pin-less") and while `mapHits` hasn't resolved yet
  // (`null` — this fetch has no SSR equivalent). `adapterReady` (not just
  // `mapHits`/`outage`) is a dependency so this also fires the *first*
  // time the async adapter becomes available, not only on later prop
  // changes.
  useEffect(() => {
    if (!adapterReady) return
    adapterRef.current?.setData(
      hitsToFeatureCollection(outage || !mapHits ? [] : mapHits),
    )
  }, [mapHits, outage, adapterReady])

  // §2.4 desktop popup vs §3.3 mobile docked panel — the one JS
  // breakpoint branch this view needs (use-is-desktop.ts).
  useEffect(() => {
    const adapter = adapterRef.current
    if (!adapter) return
    if (!isDesktop || !selectedHit) {
      adapter.closePopup()
      return
    }

    const node = document.createElement('div')
    let root: Root | null = createRoot(node)
    root.render(
      <MiniCard hit={selectedHit} onClose={() => setSelectedHitId(null)} />,
    )
    adapter.openPopup([selectedHit.geo.lng, selectedHit.geo.lat], node)

    return () => {
      adapter.closePopup()
      // Unmounting synchronously during the same effect-cleanup pass a
      // new popup's root is about to mount is safe here — `root` is
      // this closure's own instance, not the next one.
      root?.unmount()
      root = null
    }
  }, [isDesktop, selectedHit])

  // §1.6 cross-highlight, card → pin — driven by hover/focus on a list
  // card (desktop split view only; there is no list column to hover on
  // mobile).
  const [highlightedHitId, setHighlightedHitId] = useState<string | null>(null)
  useEffect(() => {
    if (!adapterReady) return
    adapterRef.current?.setHighlightedHit(highlightedHitId)
  }, [highlightedHitId, adapterReady])

  // §1.4's dismiss semantics: Escape closes the mini card, matching the
  // filter popover's own precedent (M2 §1.6) reused here rather than
  // reinvented.
  useEffect(() => {
    if (!selectedHitId) return
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') setSelectedHitId(null)
    }
    document.addEventListener('keydown', handleKeyDown)
    return () => document.removeEventListener('keydown', handleKeyDown)
  }, [selectedHitId])

  const showListColumnOutage = outage
  // §2.1's own list column — driven by `listHits` (the 24/page window),
  // never `mapHits`: a page with no cards of its own stays "empty" here
  // even while the map pane beside it (or the mobile overlay below,
  // driven by `mapHits` instead) still has real pins, per §1.3's own
  // accepted asymmetry.
  const showListColumnEmpty = !outage && listHits.length === 0
  // The mobile full-screen map has no separate list column at all — its
  // one "nothing to show" signal has to be the map's own data. `null`
  // (not yet loaded) deliberately does *not* count as empty, so a direct
  // `?view=map` load never flashes this before the first response
  // arrives.
  const showMapPaneEmpty = !outage && mapHits !== null && mapHits.length === 0

  return (
    <div
      // e2e hook (tests/e2e/m3.parity.spec.ts), not a styling/behaviour
      // hook: real pins are aria-hidden HTML markers mounted outside
      // React by the map library itself (§4), so there is no accessible
      // per-pin DOM an outside test could read ids back from without
      // driving a real cluster-expand gesture per pin. `data-listing-ids`
      // publishes the same slug list `geojson.ts` fed into the pins/
      // cluster source (`mapHits`, §1.3's own up-to-`MAX_HITS_PER_PAGE`
      // window — not `listHits`) as one stable, always-present attribute
      // instead. Slugs (not ids): the same public identifier
      // `a[href="/property/{slug}"]` already exposes in the list grid
      // (result-card.tsx), so a parity test compares the two sets with no
      // id/slug translation of its own. Empty during an outage or while
      // `mapHits` hasn't resolved yet, mirroring the pin-less map (§1.8).
      data-testid="map-view"
      data-listing-ids={JSON.stringify(
        outage || !mapHits ? [] : mapHits.map((hit) => hit.slug),
      )}
      className="flex flex-col lg:h-[clamp(480px,75vh,820px)] lg:flex-row"
    >
      {/* §2.1 desktop list column — hidden on mobile, where the map is
          the sole visible surface. */}
      <div className="hidden lg:block lg:min-w-[360px] lg:flex-[1_1_42%] lg:overflow-y-auto lg:pr-2">
        {showListColumnOutage ? (
          <OutagePanel onRetry={onRetry} />
        ) : showListColumnEmpty ? (
          <MapEmptyMessage
            unfilteredHref={unfilteredHref}
            areaLabel={areaLabel}
            channel={channel}
          />
        ) : (
          <>
            <div className="flex flex-col gap-6">
              {listHits.map((hit) => (
                <div
                  key={hit.id}
                  onMouseEnter={() => setHighlightedHitId(hit.id)}
                  onMouseLeave={() => setHighlightedHitId(null)}
                  onFocus={() => setHighlightedHitId(hit.id)}
                  onBlur={() => setHighlightedHitId(null)}
                  className={cn(
                    'opacity-transition rounded-[var(--radius-md)]',
                    highlightedHitId === hit.id &&
                      'bg-clay-050 outline-ring outline-2 outline-offset-2',
                  )}
                >
                  <ResultCard hit={hit} now={now} />
                </div>
              ))}
            </div>

            {/* §2.1: "Pagination (M2 §3.7) sits at the bottom of this
                column, inside its own scroll container — unchanged in
                mechanics." Driven by `listHits`'s own page/total, never
                the map's up-to-200 window (`Pagination` itself already
                renders nothing when there's only one page). */}
            <div className="mt-8">
              <Pagination
                page={listPage}
                totalPages={listTotalPages}
                hrefForPage={listHrefForPage}
                onSelect={onListPageChange}
              />
            </div>
          </>
        )}
      </div>

      {/* Map pane — full-screen fixed below the header on mobile,
          relatively-positioned and 58%-width beside the list column on
          desktop. `relative` (not `static`) on the desktop variant is
          load-bearing, not decorative: the floating chrome below
          (search-as-you-move pills, overlays, the mini card) is
          `absolute`-positioned and needs *this* element as its
          containing block — `static` would let it escape to the
          viewport's own initial containing block instead. */}
      <div
        className={cn(
          'fixed inset-x-0 top-14 bottom-0 z-30',
          'lg:border-border lg:relative lg:inset-auto lg:z-auto lg:h-auto lg:min-w-0 lg:flex-[1_1_58%] lg:border-l',
        )}
      >
        <div ref={containerRef} className="size-full" />

        {dimmed && (
          <div
            aria-hidden="true"
            className="opacity-transition bg-background/40 pointer-events-none absolute inset-0"
          />
        )}

        <SearchAsYouMoveControls
          enabled={searchAsYouMove.enabled}
          onToggle={searchAsYouMove.toggleEnabled}
          showSearchThisArea={searchAsYouMove.showSearchThisArea}
          onSearchThisArea={searchAsYouMove.searchThisArea}
        />

        {/* §1.8 point 3: a tile failure collapses the map pane to the
            overlay on every viewport — the list column (if visible)
            stays entirely unaffected. */}
        {tilesFailed && (
          <div className="absolute inset-0 flex items-center justify-center p-4">
            <MapOverlay variant={{ kind: 'tiles-failed', listHref }} />
          </div>
        )}

        {/* Mobile-only (gated on the same `isDesktop` flag the mini
            card's own mechanism uses, not CSS `lg:hidden` alone — jsdom
            has no CSS engine to hide it there, and a real browser gets
            the identical result either way since this only ever renders
            client-side, §1.8): the map is the sole visible surface here
            — there is no separate list column to carry this copy, so it
            renders over the map instead, driven by the map's *own* data
            (`showMapPaneEmpty`, `mapHits`), not the desktop list column's
            `listHits`. */}
        {!tilesFailed && !isDesktop && (
          <>
            {showListColumnOutage && (
              <div className="absolute inset-0 flex items-center justify-center p-4">
                <MapOverlay variant={{ kind: 'outage', onRetry }} />
              </div>
            )}
            {showMapPaneEmpty && (
              <div className="absolute inset-0 flex items-center justify-center p-4">
                <MapOverlay
                  variant={{
                    kind: 'empty',
                    unfilteredHref,
                    areaLabel,
                    channel,
                  }}
                />
              </div>
            )}
          </>
        )}

        {/* §3.3 mobile docked mini card — desktop uses a real map
            popup instead (the effect above), so this never renders
            there. */}
        {selectedHit && !isDesktop && (
          <div className="mini-card-dock-enter fixed inset-x-0 bottom-0 z-40">
            <MiniCard
              hit={selectedHit}
              onClose={() => setSelectedHitId(null)}
            />
          </div>
        )}

        {/* §3.1/§3.2: hidden while a mini card is open, to avoid two
            overlapping bottom-anchored controls. */}
        {!selectedHit && !isDesktop && (
          <div className="fixed inset-x-0 bottom-6 z-30 flex justify-center">
            <a
              href={listHref}
              className="bg-primary text-primary-foreground flex h-11 items-center gap-1.5 rounded-[var(--radius-full)] px-4 text-sm font-medium"
            >
              List ({totalCount})
            </a>
          </div>
        )}
      </div>
    </div>
  )
}
