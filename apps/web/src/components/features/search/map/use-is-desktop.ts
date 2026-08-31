'use client'

import { useEffect, useState } from 'react'

/** M3-DESIGN-SPEC.md §0: "≥1024px is 'desktop' throughout this spec,"
 * the same threshold M2 §1.8 already uses for its 3-column result grid
 * — kept as one shared constant here rather than repeating the literal
 * everywhere a JS (not just CSS `lg:`) breakpoint decision is needed. */
const DESKTOP_MEDIA_QUERY = '(min-width: 1024px)'

function readIsDesktop(): boolean {
  if (
    typeof window === 'undefined' ||
    typeof window.matchMedia !== 'function'
  ) {
    return false
  }
  return window.matchMedia(DESKTOP_MEDIA_QUERY).matches
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
  // SSR / first paint: `window` is unavailable, so this starts false.
  // The effect below syncs to the real viewport after hydration — without
  // that sync, a desktop session stays stuck on the mobile branch forever
  // (React reuses the server-rendered useState value and never re-runs
  // the lazy initializer on the client).
  const [isDesktop, setIsDesktop] = useState(readIsDesktop)

  useEffect(() => {
    if (typeof window.matchMedia !== 'function') return
    const mediaQueryList = window.matchMedia(DESKTOP_MEDIA_QUERY)
    setIsDesktop(mediaQueryList.matches)

    function handleChange(event: MediaQueryListEvent) {
      setIsDesktop(event.matches)
    }

    mediaQueryList.addEventListener('change', handleChange)
    return () => mediaQueryList.removeEventListener('change', handleChange)
  }, [])

  return isDesktop
}
