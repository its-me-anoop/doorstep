'use client'

import { useId, useState } from 'react'
import { X } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'

/** M1-DESIGN-SPEC.md §1.4: "8 common UK residential features as
 * click-to-add outline chips ... teaches what a strong listing includes
 * rather than presenting a blank text field and hoping." */
const SUGGESTED_FEATURES = [
  'Garden',
  'Off-street parking',
  'Garage',
  'Double glazing',
  'Near the station',
  'Fitted kitchen',
  'En-suite',
  'Period features',
] as const

const FEATURES_MAX = 10

interface FeatureChipInputProps {
  value: string[]
  onChange: (next: string[]) => void
}

/**
 * The step 4 "key features" chip input (M1-DESIGN-SPEC.md §1.4).
 * Controlled — the wizard's single RHF form owns `features`, this
 * component only ever proposes the next array via `onChange`, matching
 * how a `Controller`-wrapped field is normally driven.
 */
export function FeatureChipInput({ value, onChange }: FeatureChipInputProps) {
  const [draft, setDraft] = useState('')
  const inputId = useId()
  const atMax = value.length >= FEATURES_MAX

  const suggestions = SUGGESTED_FEATURES.filter(
    (feature) =>
      !value.some((added) => added.toLowerCase() === feature.toLowerCase()),
  )

  function addFeature(rawFeature: string) {
    const feature = rawFeature.trim()
    if (!feature || atMax) return
    if (value.some((added) => added.toLowerCase() === feature.toLowerCase()))
      return
    onChange([...value, feature])
    setDraft('')
  }

  function removeFeature(feature: string) {
    onChange(value.filter((added) => added !== feature))
  }

  return (
    <div className="flex flex-col gap-3">
      {suggestions.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {suggestions.map((feature) => (
            <button
              key={feature}
              type="button"
              onClick={() => addFeature(feature)}
              className="border-paper-300 text-muted-foreground hover:border-primary hover:text-foreground rounded-[var(--radius-sm)] border bg-transparent px-2.5 py-1 text-sm transition-colors"
            >
              {feature}
            </button>
          ))}
        </div>
      )}

      <div className="flex flex-col gap-2">
        <Label htmlFor={inputId}>Add a feature</Label>
        <div className="flex gap-2">
          <Input
            id={inputId}
            value={draft}
            aria-disabled={atMax}
            disabled={atMax}
            onChange={(event) => setDraft(event.target.value)}
            onKeyDown={(event) => {
              if (event.key !== 'Enter') return
              event.preventDefault()
              addFeature(draft)
            }}
            className="h-11 rounded-[var(--radius-md)]"
          />
          <Button
            type="button"
            variant="secondary"
            aria-disabled={atMax}
            onClick={() => {
              if (atMax) return
              addFeature(draft)
            }}
            className="h-11 rounded-[var(--radius-md)] px-4"
          >
            Add
          </Button>
        </div>
      </div>

      {value.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {value.map((feature) => (
            <span
              key={feature}
              className="bg-secondary text-secondary-foreground inline-flex items-center gap-1.5 rounded-[var(--radius-sm)] px-2.5 py-1 text-sm"
            >
              {feature}
              <button
                type="button"
                onClick={() => removeFeature(feature)}
                aria-label={`Remove ${feature}`}
                className="text-muted-foreground hover:text-foreground -m-1 flex size-6 items-center justify-center"
              >
                <X aria-hidden="true" className="size-3.5" />
              </button>
            </span>
          ))}
        </div>
      )}

      <p className="text-muted-foreground text-xs">
        {atMax
          ? "You've added the maximum of 10 features."
          : `${value.length} of ${FEATURES_MAX} features added.`}
      </p>
    </div>
  )
}
