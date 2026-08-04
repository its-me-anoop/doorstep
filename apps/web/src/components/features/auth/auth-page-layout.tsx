import type { ReactNode } from 'react'

import { MediaPlaceholder } from '@/components/media-placeholder'

/**
 * The shared sign-in/sign-up shell: asymmetric two-column on desktop
 * (55/45), the form in a flat --surface panel with no drop shadow; the
 * left column (editorial photo + reassurance line) drops entirely on
 * mobile rather than pushing the form below the fold (DESIGN-SPEC.md
 * §4).
 */
export function AuthPageLayout({ children }: { children: ReactNode }) {
  return (
    <div className="mx-auto grid max-w-[1200px] gap-8 px-5 py-8 sm:px-8 md:grid-cols-[55%_1fr] md:items-center md:gap-16 md:py-16 lg:px-16">
      <div className="hidden md:block">
        <MediaPlaceholder className="aspect-[4/5]" />
        <p className="text-muted-foreground mt-6 max-w-[38ch] text-[length:var(--text-lead)] leading-relaxed">
          Reading&rsquo;s newest property site — free to browse, free to list
          while we build supply.
        </p>
      </div>
      <div className="border-border bg-card mx-auto w-full min-w-0 rounded-[var(--radius-lg)] border p-6 sm:p-10 md:max-w-[480px] md:min-w-[400px]">
        {children}
      </div>
    </div>
  )
}
