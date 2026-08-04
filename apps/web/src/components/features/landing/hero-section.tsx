import Link from 'next/link'

import { MediaPlaceholder } from '@/components/media-placeholder'
import { Button } from '@/components/ui/button'

/**
 * Asymmetric 58/42 grid, left-aligned (DESIGN-SPEC.md §3.2). On mobile
 * the grid collapses to one column and the image drops below the CTA
 * row simply because it's second in document order — no explicit
 * reordering needed.
 *
 * Only the four elements the spec lists (eyebrow, headline, subcopy, CTA
 * row) get the once-on-load entrance animation — the reassurance line
 * sits outside `.hero-enter` deliberately.
 */
export function HeroSection() {
  return (
    <section className="px-5 pt-12 pb-16 sm:px-8 md:pt-20 md:pb-24 lg:px-16">
      <div className="mx-auto grid max-w-[1200px] gap-10 md:grid-cols-[58fr_42fr] md:items-center md:gap-12">
        <div className="flex flex-col items-start gap-6">
          <div className="hero-enter flex flex-col items-start gap-6">
            <p className="text-primary text-xs font-semibold tracking-[0.04em] uppercase">
              Launching in Reading &amp; the Thames Valley
            </p>
            <h1 className="text-foreground text-[clamp(2.25rem,6vw+1rem,4.1875rem)] leading-[1.05]">
              A property site that actually knows Reading.
            </h1>
            <p className="text-muted-foreground max-w-[42ch] text-[length:var(--text-lead)] leading-relaxed">
              We&rsquo;re onboarding independent agents across Caversham,
              Tilehurst, Earley and the town centre right now, and taking vetted
              listings straight from private owners and landlords too. Create
              your account and be first through the door when we open search.
            </p>
            <div className="flex flex-wrap items-center gap-6">
              <Button
                render={<Link href="/sign-up" />}
                className="h-11 rounded-[var(--radius-md)] px-6"
              >
                Create your account
              </Button>
              <Link
                href="/sign-up?intent=agent"
                className="text-foreground hover:text-primary text-sm font-medium"
              >
                I&rsquo;m an agent →
              </Link>
            </div>
          </div>
          <p className="text-muted-foreground text-sm">
            Free while we build Reading&rsquo;s supply. No card required.
          </p>
        </div>
        <MediaPlaceholder className="aspect-[4/5] w-full md:aspect-auto md:h-full" />
      </div>
    </section>
  )
}
