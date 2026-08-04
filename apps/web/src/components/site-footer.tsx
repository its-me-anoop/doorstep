import Link from 'next/link'

import { Wordmark } from '@/components/wordmark'

const COMPANY_LINKS = [
  { href: '/about', label: 'About' },
  { href: '/contact', label: 'Contact' },
]

const LEGAL_LINKS = [
  { href: '/privacy', label: 'Privacy' },
  { href: '/cookies', label: 'Cookies' },
  { href: '/terms', label: 'Terms' },
]

/**
 * Minimal, not decorative (DESIGN-SPEC.md §3.6). No social icon row —
 * empty icon links are a worse signal than no row at all when there are
 * no active accounts yet to link to.
 */
export function SiteFooter() {
  return (
    <footer className="border-border bg-background border-t">
      <div className="mx-auto max-w-[1200px] px-5 py-16 sm:px-8 lg:px-16">
        <div className="flex flex-col gap-12 sm:flex-row sm:justify-between">
          <div className="max-w-[32ch]">
            <Wordmark />
            <p className="text-muted-foreground mt-3 text-sm">
              A property site that actually knows Reading.
            </p>
          </div>
          <div className="flex gap-16">
            <div>
              <p className="text-muted-foreground text-xs font-semibold tracking-[0.04em] uppercase">
                Company
              </p>
              <ul className="mt-3 flex flex-col gap-2">
                {COMPANY_LINKS.map((link) => (
                  <li key={link.href}>
                    <Link
                      href={link.href}
                      className="text-foreground hover:text-primary text-sm"
                    >
                      {link.label}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
            <div>
              <p className="text-muted-foreground text-xs font-semibold tracking-[0.04em] uppercase">
                Legal
              </p>
              <ul className="mt-3 flex flex-col gap-2">
                {LEGAL_LINKS.map((link) => (
                  <li key={link.href}>
                    <Link
                      href={link.href}
                      className="text-foreground hover:text-primary text-sm"
                    >
                      {link.label}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </div>
        <p className="text-muted-foreground mt-16 text-xs">
          Doorstep is a Flutterly Ltd project, built and run from Reading.
        </p>
      </div>
    </footer>
  )
}
