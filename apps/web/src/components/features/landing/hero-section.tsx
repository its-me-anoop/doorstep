import Link from 'next/link'

import { HeroSearchBox } from '@/components/features/landing/hero-search-box'
import { MediaPlaceholder } from '@/components/media-placeholder'

/**
 * Asymmetric 58/42 grid, left-aligned (DESIGN-SPEC.md §3.2). On mobile
 * the grid collapses to one column and the image drops below the search
 * box simply because it's second in document order — no explicit
 * reordering needed.
 *
 * M2 pivot (M2-DESIGN-SPEC.md §2.1): the hero's job flips from "capture
 * an account before there's anything to show" to "get Sarah into a real
 * result set" — the old CTA row (a "Create your account" button) is
 * replaced by the working search box, the primary interactive element.
 * Sign-up demotes to a quiet secondary link below it, now honest about
 * what an account is actually *for* (saving, a real M4 benefit) rather
 * than the gate to using the product at all. "I'm an agent →" is
 * unchanged — the supply-side funnel didn't get simpler just because
 * demand-side search opened.
 *
 * Only the four elements the spec lists (eyebrow, headline, subcopy,
 * search box) get the once-on-load entrance animation — the account/agent
 * links and the reassurance line sit outside `.hero-enter` deliberately,
 * as the hero's quieter, secondary content.
 */
export function HeroSection() {
  return (
    <section className="px-5 pt-12 pb-16 sm:px-8 md:pt-20 md:pb-24 lg:px-16">
      <div className="mx-auto grid max-w-[1200px] gap-10 md:grid-cols-[58fr_42fr] md:items-center md:gap-12">
        <div className="flex flex-col items-start gap-6">
          <div className="hero-enter flex w-full flex-col items-start gap-6">
            <p className="text-primary text-xs font-semibold tracking-[0.04em] uppercase">
              Launching in Reading &amp; the Thames Valley
            </p>
            <h1 className="text-foreground text-[clamp(2.25rem,6vw+1rem,4.1875rem)] leading-[1.05]">
              A property site that actually knows Reading.
            </h1>
            <p className="text-muted-foreground max-w-[42ch] text-[length:var(--text-lead)] leading-relaxed">
              We&rsquo;re onboarding independent agents across Caversham,
              Tilehurst, Earley and the town centre, and taking vetted listings
              straight from private owners and landlords too. Search
              what&rsquo;s live below, or set up an account to save your
              favourites once you find them.
            </p>
            <HeroSearchBox />
          </div>
          <div className="flex flex-wrap items-center gap-6">
            <Link
              href="/sign-up"
              className="text-foreground hover:text-primary text-sm"
            >
              Want to save homes as you go?{' '}
              <span className="font-semibold">Create a free account →</span>
            </Link>
            <Link
              href="/sign-up?intent=agent"
              className="text-foreground hover:text-primary text-sm font-medium"
            >
              I&rsquo;m an agent →
            </Link>
          </div>
          <p className="text-muted-foreground text-sm">
            Free to search, free to list while we build supply.
          </p>
        </div>
        <MediaPlaceholder className="aspect-[4/5] w-full md:aspect-auto md:h-full" />
      </div>
    </section>
  )
}
