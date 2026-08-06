import { List, Map as MapIcon } from 'lucide-react'

interface MapViewToggleButtonProps {
  isMapView: boolean
  onClick: () => void
}

/**
 * The desktop sort/count row's compact `[ Map ]`/`[ List ]` toggle
 * (M3-DESIGN-SPEC.md §2, the one control M2 §5.9 already reserved this
 * slot for). A real `<button>` (not a plain `<a>`) with `onClick`, since
 * results-view.tsx already owns one `navigate()` helper that every other
 * URL-state change in this view goes through
 * (`router.replace` + `startTransition`) — this reuses that, rather than
 * a second, link-based navigation path with its own history semantics.
 */
export function MapViewToggleButton({
  isMapView,
  onClick,
}: MapViewToggleButtonProps) {
  const Icon = isMapView ? List : MapIcon

  return (
    <button
      type="button"
      aria-pressed={isMapView}
      onClick={onClick}
      className="border-input text-foreground hover:bg-muted inline-flex h-9 items-center gap-1.5 rounded-[var(--radius-md)] border px-3 text-sm font-medium"
    >
      <Icon aria-hidden="true" className="size-4" />
      {isMapView ? 'List' : 'Map'}
    </button>
  )
}
