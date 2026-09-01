import { Map as MapIcon } from 'lucide-react'

interface MobileMapTogglePillProps {
  onClick: () => void
}

/**
 * §3.1's "Map" pill — the list-side half of the mobile
 * one-destination-at-a-time toggle (the map-side half, "List (N)", is
 * `map-view.tsx`'s own bottom pill). Lives in the results toolbar in
 * normal document flow so it cannot float over the heading or empty/
 * outage copy.
 */
export function MobileMapTogglePill({ onClick }: MobileMapTogglePillProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="bg-primary text-primary-foreground inline-flex h-11 shrink-0 items-center gap-1.5 rounded-[var(--radius-full)] px-4 text-sm font-medium lg:hidden"
    >
      <MapIcon aria-hidden="true" className="size-4" />
      Map
    </button>
  )
}
