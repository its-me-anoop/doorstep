import * as React from 'react'
import { ChevronDown } from 'lucide-react'

import { cn } from '@/lib/utils'

/**
 * A plain native `<select>`, not a custom Base UI listbox — the same
 * call Checkbox (checkbox.tsx) already made and documented: native
 * semantics give correct keyboard/label/screen-reader behaviour for
 * free, and stay trivially testable with Testing Library
 * (`getByLabelText` + `fireEvent.change`), which the wizard's many
 * selects (M1-DESIGN-SPEC.md §3.1, §3.3) lean on heavily. Styled to
 * match Input's chrome exactly so a form mixing text inputs and selects
 * reads as one control family.
 */
function Select({ className, children, ...props }: React.ComponentProps<'select'>) {
  return (
    <span className="relative block w-full">
      <select
        data-slot="select"
        className={cn(
          'border-input bg-transparent text-foreground focus-visible:border-ring focus-visible:ring-ring/50 disabled:bg-input/50 aria-invalid:border-destructive aria-invalid:ring-destructive/20 h-8 w-full min-w-0 appearance-none rounded-lg border px-2.5 py-1 pr-8 text-base transition-colors outline-none focus-visible:ring-3 disabled:pointer-events-none disabled:cursor-not-allowed disabled:opacity-50 aria-invalid:ring-3 md:text-sm',
          className,
        )}
        {...props}
      >
        {children}
      </select>
      <ChevronDown
        aria-hidden="true"
        className="text-muted-foreground pointer-events-none absolute top-1/2 right-2.5 size-4 -translate-y-1/2"
      />
    </span>
  )
}

export { Select }
