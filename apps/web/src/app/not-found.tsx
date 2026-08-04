import Link from 'next/link'

import { Wordmark } from '@/components/wordmark'
import { Button } from '@/components/ui/button'

/**
 * The global 404. Rendered inside the root layout only (not any route
 * group's layout), so it carries its own minimal header rather than
 * pulling in SiteHeader — this page has to work even when nothing else
 * resolved.
 */
export default function NotFound() {
  return (
    <div className="flex flex-1 flex-col">
      <header className="border-border border-b px-5 py-4 sm:px-8">
        <Wordmark />
      </header>
      <main className="mx-auto flex max-w-[640px] flex-1 flex-col justify-center px-5 py-24 sm:px-8">
        <p className="text-primary text-xs font-semibold tracking-[0.04em] uppercase">
          404
        </p>
        <h1 className="text-foreground mt-3 text-[length:var(--text-h1)] leading-[1.12]">
          That page isn&rsquo;t here.
        </h1>
        <p className="text-muted-foreground mt-4 max-w-[46ch] text-[length:var(--text-lead)] leading-relaxed">
          The page you&rsquo;re looking for may have moved, or never existed.
          Let&rsquo;s get you back to somewhere real.
        </p>
        <Button
          render={<Link href="/" />}
          className="mt-8 h-11 w-fit rounded-[var(--radius-md)] px-6"
        >
          Back to Doorstep
        </Button>
      </main>
    </div>
  )
}
