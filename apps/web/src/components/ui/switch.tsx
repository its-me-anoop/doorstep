import * as React from 'react'

import { cn } from '@/lib/utils'

/**
 * A labelled toggle switch (M1-DESIGN-SPEC.md §3.2 field 4, "approximate
 * location"). A plain native `<input type="checkbox">` under the visual
 * track/thumb, the same choice checkbox.tsx already made and documented:
 * native semantics give correct keyboard/label/screen-reader behaviour
 * for free. `role="switch"` is deliberately not added on top — Base UI
 * ships no native-input Switch part, and layering a non-native ARIA role
 * onto a real form control is exactly the kind of "custom ARIA widget"
 * checkbox.tsx's doc comment already avoids; a checked/unchecked
 * checkbox announces this control's actual state correctly, which is
 * what matters for PRD §7.3.
 */
function Switch({ className, ...props }: React.ComponentProps<'input'>) {
  return (
    <span className="relative inline-flex h-6 w-10 shrink-0 items-center">
      <input
        type="checkbox"
        data-slot="switch"
        className={cn(
          'peer border-input bg-secondary checked:border-primary checked:bg-primary focus-visible:ring-ring/50 aria-invalid:border-destructive absolute inset-0 m-0 size-full cursor-pointer appearance-none rounded-[var(--radius-full)] border transition-colors outline-none focus-visible:ring-3 disabled:cursor-not-allowed disabled:opacity-50',
          className,
        )}
        {...props}
      />
      <span
        aria-hidden="true"
        className="bg-background pointer-events-none absolute top-0.5 left-0.5 size-5 rounded-[var(--radius-full)] shadow-sm transition-transform duration-150 [transition-timing-function:var(--ease-out-quart)] peer-checked:translate-x-4"
      />
    </span>
  )
}

export { Switch }
