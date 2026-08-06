import { MediaPlaceholder } from '@/components/media-placeholder'

interface LocationSectionProps {
  /** Never `addressLine1` — DET-3's privacy rule (PRD §9.2). */
  displayAddress: string
}

/**
 * LocationSection — M2-DESIGN-SPEC.md §5.6. The map itself is M3 —
 * reuses the exact `MediaPlaceholder` component the M0 hero's missing
 * photography already uses, at `aspect-[16/9]`, rather than a new
 * placeholder: "real content isn't ready yet, show calm honest
 * emptiness" is the same move for a missing map as for missing
 * photography. `location_approximate` needs no different treatment
 * here — that distinction is entirely M3's rendering problem (§5.6).
 */
export function LocationSection({ displayAddress }: LocationSectionProps) {
  return (
    <section className="flex flex-col gap-4">
      <h2 className="text-foreground text-[length:var(--text-h3)]">
        Location.
      </h2>
      <p className="text-foreground text-base font-medium">{displayAddress}</p>
      <MediaPlaceholder className="aspect-[16/9] w-full" />
    </section>
  )
}
