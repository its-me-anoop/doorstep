import * as React from 'react'
import { Check } from 'lucide-react'

import { cn } from '@/lib/utils'

/**
 * A plain native `<input type="checkbox">`, not Base UI's Checkbox part.
 * The consent checkbox (sign-up form) is the only user of this so far;
 * native semantics give correct keyboard/label/screen-reader behaviour
 * for free and are trivially testable with Testing Library, which a
 * custom ARIA widget would need extra work to match.
 */
function Checkbox({ className, ...props }: React.ComponentProps<'input'>) {
  return (
    <span className="relative inline-flex size-[18px] shrink-0">
      <input
        type="checkbox"
        data-slot="checkbox"
        className={cn(
          'peer border-input bg-background checked:border-primary checked:bg-primary aria-invalid:border-destructive size-[18px] shrink-0 cursor-pointer appearance-none rounded-[var(--radius-sm)] border transition-colors disabled:cursor-not-allowed disabled:opacity-50',
          className,
        )}
        {...props}
      />
      <Check
        aria-hidden="true"
        className="text-primary-foreground pointer-events-none absolute inset-0 m-auto size-3 opacity-0 peer-checked:opacity-100"
      />
    </span>
  )
}

export { Checkbox }
