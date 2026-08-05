/**
 * The wizard's 6 steps (M1-DESIGN-SPEC.md §3): one shared label list used
 * by both the step indicator (§1.2) and the review step's section
 * groupings (§3.6, "grouped under the same five section labels as steps
 * 1-5") — the spec is explicit that Review "reuses the wizard's own
 * vocabulary rather than inventing new summary copy", so this is the one
 * place that vocabulary lives.
 */
export const WIZARD_STEP_LABELS = {
  1: 'Channel & type',
  2: 'Address',
  3: 'Details',
  4: 'Description & features',
  5: 'Photos',
  6: 'Review',
} as const

export const WIZARD_STEP_COUNT = 6

export type WizardStepNumber = keyof typeof WIZARD_STEP_LABELS

export function isWizardStepNumber(value: number): value is WizardStepNumber {
  return value >= 1 && value <= WIZARD_STEP_COUNT
}
