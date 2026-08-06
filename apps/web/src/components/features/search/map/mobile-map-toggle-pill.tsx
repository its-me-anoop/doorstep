import { Map as MapIcon } from 'lucide-react'

interface MobileMapTogglePillProps {
  onClick: () => void
}

/**
 * §3.1's floating "Map" pill — the list-side half of the mobile
 * one-destination-at-a-time toggle (the map-side half, "List (N)", is
 * `map-view.tsx`'s own bottom pill, since it needs the live result
 * count that only exists once the map view's data is in scope). A real
 * `h-11` button, in normal DOM flow (visually `fixed`, but a genuine tab
 * stop).
 */
export function MobileMapTogglePill({ onClick }: MobileMapTogglePillProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="bg-primary text-primary-foreground fixed bottom-6 left-1/2 z-30 flex h-11 -translate-x-1/2 items-center gap-1.5 rounded-[var(--radius-full)] px-4 text-sm font-medium lg:hidden"
    >
      <MapIcon aria-hidden="true" className="size-4" />
      Map
    </button>
  )
}
