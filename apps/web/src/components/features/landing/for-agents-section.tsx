import Link from 'next/link'

import { MediaPlaceholder } from '@/components/media-placeholder'
import { Button } from '@/components/ui/button'

/**
 * Reversed 42/58 split (placeholder media on the left this time) to
 * break rhythm with the hero rather than repeating the same template
 * (DESIGN-SPEC.md §3.5 — and the impeccable.style rule against
 * repeating one section template throughout a page).
 */
export function ForAgentsSection() {
  return (
    <section className="px-5 py-16 sm:px-8 md:py-24 lg:px-16">
      <div className="mx-auto grid max-w-[1200px] gap-10 md:grid-cols-[42fr_58fr] md:items-center md:gap-12">
        <MediaPlaceholder className="aspect-[4/5] w-full md:aspect-auto md:h-full" />
        <div>
          <h2 className="text-foreground text-[length:var(--text-h2)] leading-[1.2]">
            Free to list, while we build supply.
          </h2>
          <p className="text-muted-foreground mt-4 max-w-[60ch] text-[length:var(--text-base)] leading-relaxed">
            If you&rsquo;re an independent agency, there&rsquo;s no membership
            fee during the Reading beta — bring your instructions across and get
            in front of buyers and tenants who are only looking here.
          </p>
          <p className="text-muted-foreground mt-4 max-w-[60ch] text-[length:var(--text-base)] leading-relaxed">
            Selling privately or letting a spare room? A guided wizard tells you
            exactly what a legal listing needs, EPC included, so you&rsquo;re
            never guessing what&rsquo;s required.
          </p>
          <Button
            render={<Link href="/sign-up?intent=lister" />}
            variant="secondary"
            className="mt-8 h-11 rounded-[var(--radius-md)] px-6"
          >
            List with Doorstep →
          </Button>
        </div>
      </div>
    </section>
  )
}
