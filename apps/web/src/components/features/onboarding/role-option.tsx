'use client'

/**
 * RoleOption — a single, full-width, one-click selectable row
 * (M1-DESIGN-SPEC.md §2.1). Deliberately generic (label/description/
 * onSelect only, no owner- or agent-specific branching inside it) so the
 * spec's forward-compatibility note holds: a third row later ("Join an
 * agency I've been invited to", deferred past M1) is one more array
 * entry in role-choice.tsx, not a new one-off component.
 */
interface RoleOptionProps {
  heading: string
  description: string
  onSelect: () => void
  pending?: boolean
  pendingLabel?: string
  disabled?: boolean
}

export function RoleOption({
  heading,
  description,
  onSelect,
  pending = false,
  pendingLabel,
  disabled = false,
}: RoleOptionProps) {
  return (
    <button
      type="button"
      onClick={() => {
        if (disabled) return
        onSelect()
      }}
      aria-disabled={disabled}
      className="border-input hover:border-primary hover:bg-primary-foreground focus-visible:border-primary focus-visible:bg-primary-foreground focus-visible:ring-ring/50 w-full rounded-[var(--radius-md)] border p-6 text-left transition-colors outline-none focus-visible:ring-3"
    >
      <p className="text-foreground text-[length:var(--text-lead)] font-medium">
        {heading}
      </p>
      <p className="text-muted-foreground mt-2 max-w-[60ch] text-sm leading-relaxed">
        {description}
      </p>
      {pending && pendingLabel && (
        <p className="text-muted-foreground mt-3 text-xs">{pendingLabel}</p>
      )}
    </button>
  )
}
