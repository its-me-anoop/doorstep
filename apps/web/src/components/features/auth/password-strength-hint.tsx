import { Check } from 'lucide-react'

import { cn } from '@/lib/utils'

interface PasswordStrengthHintProps {
  id: string
  password: string
  /** Field has been blurred or the form submitted, per DESIGN-SPEC.md §4:
   *  the hint only turns --destructive once the user has had a chance to
   *  finish typing, never mid-keystroke. */
  showAsError: boolean
}

/**
 * The single live requirement line under the sign-up password field —
 * doing double duty as both the "how am I doing" hint and the
 * submit-time error, rather than stacking a second, redundant message
 * (DESIGN-SPEC.md's anti-pattern checklist: no redundant label/helper
 * stacking).
 */
export function PasswordStrengthHint({
  id,
  password,
  showAsError,
}: PasswordStrengthHintProps) {
  const met = password.length >= 8

  return (
    <p
      id={id}
      aria-live="polite"
      className={cn(
        'flex items-center gap-1.5 text-sm transition-opacity',
        met && 'text-success',
        !met && showAsError && 'text-destructive',
        !met && !showAsError && 'text-muted-foreground',
      )}
    >
      {met && <Check aria-hidden="true" className="size-3.5" />}
      At least 8 characters
    </p>
  )
}
