import { CloudOff } from 'lucide-react'

import { Button } from '@/components/ui/button'

interface OutagePanelProps {
  onRetry: () => void
}

/**
 * OutagePanel — the search_unavailable 503 state (M2-DESIGN-SPEC.md
 * §1.10 point 4, §3.9). Renders in the result grid's own slot only; the
 * header, filter bar and applied chips above it keep rendering and
 * stay interactive, so retrying is one click, not a page reload. Not an
 * alert/error dialog — this is an expected, calm degraded state, not a
 * destructive one, so no `role="alert"` and no destructive-red styling.
 */
export function OutagePanel({ onRetry }: OutagePanelProps) {
  return (
    <div className="border-border rounded-[var(--radius-md)] border p-8 text-left">
      <CloudOff aria-hidden="true" className="text-muted-foreground size-5" />
      <h2 className="text-foreground mt-3 text-[length:var(--text-h4)]">
        Search’s taking a breather.
      </h2>
      <p className="text-muted-foreground mt-2 max-w-[60ch] text-base leading-relaxed">
        Something’s wrong on our end and we can’t run this search right now — it
        isn’t you.
      </p>
      <Button
        type="button"
        variant="secondary"
        onClick={onRetry}
        className="mt-4 h-11 rounded-[var(--radius-md)] px-4"
      >
        Try again
      </Button>
      <p className="text-muted-foreground mt-4 text-sm">
        Everything else on Doorstep, including listing pages you already have
        open, is working fine.
      </p>
    </div>
  )
}
