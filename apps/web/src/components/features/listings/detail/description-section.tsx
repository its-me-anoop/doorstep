interface DescriptionSectionProps {
  /** Already sanitised server-side (services/listings/get-public-listing.ts
   * reads it straight off the stored, sanitised column — PRD §7.4) —
   * rendered as plain text with `whitespace-pre-line` to preserve the
   * lister's own paragraph breaks, never `dangerouslySetInnerHTML`. */
  description: string
  features: string[]
}

/**
 * DescriptionSection — M2-DESIGN-SPEC.md §5.5. Feature chips reuse the
 * wizard's *inert-content* chip styling verbatim (M1-DESIGN-SPEC.md
 * §1.4's `bg-secondary` pair) — deliberately not the clay-tinted filter
 * chip from this milestone's own §1.1, since these describe committed
 * listing content, not an active, removable query filter.
 */
export function DescriptionSection({
  description,
  features,
}: DescriptionSectionProps) {
  return (
    <section className="flex flex-col gap-4">
      <h2 className="text-foreground text-[length:var(--text-h3)]">
        About this home.
      </h2>
      <p className="text-foreground max-w-[65ch] text-base leading-relaxed whitespace-pre-line">
        {description}
      </p>
      {features.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {features.map((feature) => (
            <span
              key={feature}
              data-testid="feature-chip"
              className="bg-secondary text-secondary-foreground inline-flex items-center gap-1.5 rounded-[var(--radius-sm)] px-2.5 py-1 text-sm"
            >
              {feature}
            </span>
          ))}
        </div>
      )}
    </section>
  )
}
