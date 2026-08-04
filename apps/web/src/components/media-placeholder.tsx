import { cn } from '@/lib/utils'

/**
 * The fallback for the hero/auth-page photography that doesn't exist
 * yet at M0 build time: a flat --surface panel with a thin --border,
 * never a generic icon or stock-illustration placeholder
 * (DESIGN-SPEC.md §3.2). Swap for a real <Image> once photography
 * lands, keeping the same radius/border treatment.
 */
export function MediaPlaceholder({ className }: { className?: string }) {
  return (
    <div
      aria-hidden="true"
      className={cn(
        'border-border bg-card rounded-[var(--radius-lg)] border',
        className,
      )}
    />
  )
}
