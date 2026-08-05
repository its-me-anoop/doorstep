import Link from 'next/link'
import { Check } from 'lucide-react'

import {
  WIZARD_STEP_COUNT,
  WIZARD_STEP_LABELS,
  type WizardStepNumber,
} from './wizard-steps'

interface StepIndicatorProps {
  currentStep: WizardStepNumber
}

/**
 * M1-DESIGN-SPEC.md §1.2: an editorial "contents" treatment, explicitly
 * not the generic numbered-circles-and-line wizard rail. One progress
 * track (shared by both breakpoints), a desktop-only breadcrumb row, and
 * a mobile-only "STEP N OF 6" eyebrow — CSS visibility, not two separate
 * components, since both read the same `currentStep`.
 */
export function StepIndicator({ currentStep }: StepIndicatorProps) {
  const progress = currentStep / WIZARD_STEP_COUNT

  return (
    <div>
      <div className="bg-paper-200 relative h-0.5 w-full overflow-hidden">
        <div
          className="bg-primary absolute inset-y-0 left-0 w-full origin-left transition-transform duration-300 [transition-timing-function:var(--ease-out-expo)]"
          style={{ transform: `scaleX(${progress})` }}
        />
      </div>

      <p className="text-primary mt-3 text-xs font-semibold tracking-[0.04em] uppercase md:hidden">
        STEP {currentStep} OF {WIZARD_STEP_COUNT}
      </p>

      <ol className="mt-3 hidden flex-row flex-wrap gap-6 md:flex">
        {(Object.keys(WIZARD_STEP_LABELS) as unknown as WizardStepNumber[])
          .map(Number)
          .map((step) => {
            const label = WIZARD_STEP_LABELS[step as WizardStepNumber]
            const isCurrent = step === currentStep
            const isCompleted = step < currentStep

            if (isCurrent) {
              return (
                <li key={step}>
                  <span
                    aria-current="step"
                    className="text-foreground decoration-primary text-sm font-medium underline decoration-2 underline-offset-[6px]"
                  >
                    <span className="sr-only">{`Step ${step} of ${WIZARD_STEP_COUNT} `}</span>
                    {label}
                  </span>
                </li>
              )
            }

            if (isCompleted) {
              return (
                <li key={step}>
                  <Link
                    href={`?step=${step}`}
                    className="text-foreground hover:text-primary inline-flex items-center gap-1 text-sm font-medium"
                  >
                    <Check aria-hidden="true" className="size-3.5" />
                    {label}
                  </Link>
                </li>
              )
            }

            return (
              <li key={step}>
                <span className="text-muted-foreground text-sm font-medium">
                  {label}
                </span>
              </li>
            )
          })}
      </ol>
    </div>
  )
}
