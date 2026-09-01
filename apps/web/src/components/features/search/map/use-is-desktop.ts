'use client'

import { useSyncExternalStore } from 'react'

/** M3-DESIGN-SPEC.md §0: "≥1024px is 'desktop' throughout this spec,"
 * the same threshold M2 §1.8 already uses for its 3-column result grid
 * — kept as one shared constant here rather than repeating the literal
 * everywhere a JS (not just CSS `lg:`) breakpoint decision is needed. */
const DESKTOP_MEDIA_QUERY = '(min-width: 1024px)'

function subscribe(onStoreChange: () => void): () => void {
  if (typeof window.matchMedia !== 'function') {
    return () => {}
  }
  const mediaQueryList = window.matchMedia(DESKTOP_MEDIA_QUERY)
  mediaQueryList.addEventListener('change', onStoreChange)
  return () => mediaQueryList.removeEventListener('change', onStoreChange)
}

function getSnapshot(): boolean {
  if (typeof window.matchMedia !== 'function') return false
  return window.matchMedia(DESKTOP_MEDIA_QUERY).matches
}

/** SSR / first paint before hydration: no window → treat as mobile.
 * `useSyncExternalStore` then re-reads `getSnapshot` on the client so a
 * desktop viewport is not stuck on the mobile branch forever (the bug
 * the old useState+effect path had when the effect was not allowed to
 * call setState synchronously under react-hooks/set-state-in-effect). */
function getServerSnapshot(): boolean {
  return false
}

/**
 * Almost everything about the map view's desktop-vs-mobile layout is
 * plain, responsive CSS (`lg:` utility classes) — no JS breakpoint
 * detection needed. This hook exists for the one place that genuinely
 * can't be CSS-only: the mini card's *mechanism* differs by breakpoint
 * (§2.4's anchored map-library popup on desktop vs §3.3's docked bottom
 * panel on mobile are two different DOM/JS constructs, not one element
 * two stylesheets could switch between), so map-view.tsx needs to know
 * which one to imperatively construct.
 */
export function useIsDesktop(): boolean {
  return useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot)
}
