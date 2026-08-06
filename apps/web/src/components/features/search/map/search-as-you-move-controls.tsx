'use client'

import { Checkbox } from '@/components/ui/checkbox'

interface SearchAsYouMoveControlsProps {
  enabled: boolean
  onToggle: () => void
  showSearchThisArea: boolean
  onSearchThisArea: () => void
}

/**
 * §1.5's two floating pills. A real `<input type="checkbox">` under
 * custom chrome (the same pattern already used for Type/Furnished,
 * `components/ui/checkbox.tsx`), plus the button-styled "Search this
 * area" affordance that only ever appears while off and a move is
 * pending. Copy is exactly the spec's own: "Search as I move the map."
 */
export function SearchAsYouMoveControls({
  enabled,
  onToggle,
  showSearchThisArea,
  onSearchThisArea,
}: SearchAsYouMoveControlsProps) {
  return (
    <div className="absolute top-3 left-3 z-10 flex flex-wrap gap-2">
      <label className="bg-card border-border flex h-11 cursor-pointer items-center gap-2 rounded-[var(--radius-md)] border px-3 text-sm lg:h-9">
        <Checkbox checked={enabled} onChange={onToggle} />
        Search as I move the map
      </label>

      {showSearchThisArea && (
        <button
          type="button"
          onClick={onSearchThisArea}
          className="bg-primary text-primary-foreground flex h-11 items-center rounded-[var(--radius-md)] px-4 text-sm font-medium lg:h-9"
        >
          Search this area
        </button>
      )}
    </div>
  )
}
