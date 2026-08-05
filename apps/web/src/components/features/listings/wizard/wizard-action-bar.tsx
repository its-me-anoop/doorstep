import { Button } from '@/components/ui/button'

interface WizardActionBarProps {
  showBack: boolean
  onBack: () => void
  onContinue: () => void
}

/**
 * M1-DESIGN-SPEC.md §1.2.1: sticky on mobile so "Continue" is never
 * scrolled out of reach; plain flow on desktop, where the viewport is
 * comfortably taller than a step's content. One component for both
 * breakpoints (CSS only) rather than two — both need the exact same two
 * handlers.
 */
export function WizardActionBar({
  showBack,
  onBack,
  onContinue,
}: WizardActionBarProps) {
  return (
    <div className="bg-background border-border sticky bottom-0 mt-8 flex items-center justify-between gap-4 border-t py-4 [padding-bottom:max(1rem,env(safe-area-inset-bottom))] md:static md:border-t-0 md:py-0">
      {showBack ? (
        <Button
          type="button"
          variant="ghost"
          onClick={onBack}
          className="h-11 rounded-[var(--radius-md)] px-4"
        >
          Back
        </Button>
      ) : (
        <span />
      )}
      <Button
        type="button"
        onClick={onContinue}
        className="h-11 rounded-[var(--radius-md)] px-6"
      >
        Continue
      </Button>
    </div>
  )
}
