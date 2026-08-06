'use client'

import { useCallback, useEffect, useRef, useState } from 'react'

import type { MapBoundingBox } from '@/lib/search-url'

/** §1.5: "every `moveend` debounces 400ms, then fires the bbox requery
 * automatically" — the one literal timing value this state machine
 * introduces. */
const AUTO_REQUERY_DEBOUNCE_MS = 400

interface UseSearchAsYouMoveOptions {
  /** Fires exactly once per requery decision (a manual "Search this
   * area" click, or auto mode's debounced settle) with the bbox to
   * search — the caller (map-view.tsx) is the one that actually knows
   * how to turn that into a URL/query change (`applyBboxSearch`,
   * `lib/search-url.ts`); this hook only decides *when*. */
  onRequery: (bbox: MapBoundingBox) => void
}

interface UseSearchAsYouMoveResult {
  /** The checkbox's own state (§1.5's "Search as I move the map"). */
  enabled: boolean
  /** Whether the "Search this area" pill should render — only ever true
   * while `enabled` is false and a move has happened since the last
   * requery (§1.5: "When on... 'Search this area' never appears"). */
  showSearchThisArea: boolean
  toggleEnabled: () => void
  /** Call on every user-initiated `moveend` (the map adapter already
   * filters out programmatic camera moves before this is reached). */
  notifyMoveEnd: (bbox: MapBoundingBox) => void
  /** The "Search this area" button's own click handler. A no-op if
   * nothing is pending (defensive — the button is never rendered in
   * that state, but this keeps the function safe to call unconditionally). */
  searchThisArea: () => void
}

/**
 * The state machine behind §1.5. Kept as its own hook (SRP) rather than
 * folded into map-view.tsx's own state, since its rules — debounce,
 * "enabling doesn't itself requery," "enabling with a move already
 * pending fires it once and arms auto mode" — are exhaustively specified
 * and exhaustively testable in isolation, with no dependency on a real
 * map instance.
 *
 * Internal state is mirrored into refs (`enabledRef`/`pendingBboxRef`)
 * so `notifyMoveEnd`/`toggleEnabled`/`searchThisArea` stay referentially
 * stable (`useCallback` with an empty dependency array) while still
 * always reading the *current* value — necessary because `notifyMoveEnd`
 * is handed once to the map adapter's non-React `on('moveend', ...)`
 * subscription (map-view.tsx), not re-subscribed on every render; a
 * plain closure over `enabled` state would go stale the first time the
 * checkbox is toggled after that subscription is made.
 */
export function useSearchAsYouMove({
  onRequery,
}: UseSearchAsYouMoveOptions): UseSearchAsYouMoveResult {
  const [enabled, setEnabled] = useState(false)
  const [pendingBbox, setPendingBboxState] = useState<MapBoundingBox | null>(
    null,
  )

  const enabledRef = useRef(enabled)
  const pendingBboxRef = useRef(pendingBbox)
  const onRequeryRef = useRef(onRequery)
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  // Synced post-render (an effect), not mutated directly in the render
  // body — refs read by callbacks that fire outside React's render cycle
  // (the debounce timer, the map adapter's own event emitter) still need
  // the *latest* values, but writing to a ref while rendering is exactly
  // what react-hooks/refs flags as unsafe under concurrent rendering.
  useEffect(() => {
    enabledRef.current = enabled
    onRequeryRef.current = onRequery
  })

  const setPendingBbox = useCallback((bbox: MapBoundingBox | null) => {
    pendingBboxRef.current = bbox
    setPendingBboxState(bbox)
  }, [])

  const clearDebounce = useCallback(() => {
    if (debounceRef.current !== null) {
      clearTimeout(debounceRef.current)
      debounceRef.current = null
    }
  }, [])

  const notifyMoveEnd = useCallback(
    (bbox: MapBoundingBox) => {
      setPendingBbox(bbox)
      if (!enabledRef.current) return

      clearDebounce()
      debounceRef.current = setTimeout(() => {
        onRequeryRef.current(bbox)
        setPendingBbox(null)
      }, AUTO_REQUERY_DEBOUNCE_MS)
    },
    [clearDebounce, setPendingBbox],
  )

  const searchThisArea = useCallback(() => {
    const bbox = pendingBboxRef.current
    if (!bbox) return
    clearDebounce()
    onRequeryRef.current(bbox)
    setPendingBbox(null)
  }, [clearDebounce, setPendingBbox])

  const toggleEnabled = useCallback(() => {
    setEnabled((current) => {
      const next = !current

      if (next && pendingBboxRef.current) {
        // §1.5: "Ticking the checkbox while 'Search this area' is
        // already showing... fires that pending requery immediately,
        // once, and arms auto mode going forward."
        clearDebounce()
        onRequeryRef.current(pendingBboxRef.current)
        setPendingBbox(null)
      } else if (!next) {
        // Turning auto mode off cancels a queued-but-not-yet-fired
        // debounced requery — the user's new preference is honoured
        // immediately, not applied only to the *next* move. The pending
        // bbox itself is left in place (not cleared), so the button
        // reappears for the un-queried move rather than silently
        // dropping it.
        clearDebounce()
      }

      return next
    })
  }, [clearDebounce, setPendingBbox])

  useEffect(() => clearDebounce, [clearDebounce])

  return {
    enabled,
    showSearchThisArea: !enabled && pendingBbox !== null,
    toggleEnabled,
    notifyMoveEnd,
    searchThisArea,
  }
}
