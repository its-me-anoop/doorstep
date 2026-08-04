import Link from 'next/link'

import { cn } from '@/lib/utils'

/**
 * The "Doorstep" wordmark used in the header and footer (DESIGN-SPEC.md
 * §3: Fraunces 600, ink colour, "step" picks up --primary on hover —
 * never a gradient fill, per the banned-pattern list).
 */
export function Wordmark({ className }: { className?: string }) {
  return (
    <Link
      href="/"
      className={cn(
        'group font-display text-foreground text-[1.3125rem] font-semibold',
        className,
      )}
    >
      Door
      <span className="text-foreground group-hover:text-primary transition-colors">
        step
      </span>
    </Link>
  )
}
