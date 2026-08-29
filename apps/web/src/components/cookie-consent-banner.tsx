'use client'

import Link from 'next/link'
import { useCallback, useSyncExternalStore } from 'react'

import { Button } from '@/components/ui/button'

const STORAGE_KEY = 'doorstep-cookie-consent'

function subscribe(onStoreChange: () => void): () => void {
  window.addEventListener('storage', onStoreChange)
  return () => window.removeEventListener('storage', onStoreChange)
}

function readConsent(): string | null {
  try {
    return localStorage.getItem(STORAGE_KEY)
  } catch {
    return null
  }
}

/**
 * Essential-only cookie banner until the visitor accepts analytics
 * preferences (M6). Stores choice in localStorage. Visibility is derived
 * via useSyncExternalStore so we never setState inside an effect.
 */
export function CookieConsentBanner() {
  const consent = useSyncExternalStore(
    subscribe,
    readConsent,
    () => 'ssr-hidden',
  )
  const visible = consent === null

  const accept = useCallback(() => {
    try {
      localStorage.setItem(STORAGE_KEY, 'essential')
      // Same-tab updates don't fire `storage`; nudge subscribers manually.
      window.dispatchEvent(new Event('storage'))
    } catch {
      // ignore quota errors
    }
  }, [])

  if (!visible) return null

  return (
    <div
      role="dialog"
      aria-label="Cookie preferences"
      className="border-border bg-card fixed inset-x-4 bottom-4 z-50 mx-auto max-w-[640px] rounded-[var(--radius-lg)] border p-5 shadow-lg sm:inset-x-auto sm:right-8 sm:bottom-8"
    >
      <p className="text-foreground text-sm leading-relaxed">
        We use essential cookies to keep you signed in and remember your
        preferences. We do not use analytics cookies until you accept. See our{' '}
        <Link
          href="/cookies"
          className="text-primary underline underline-offset-2"
        >
          cookie policy
        </Link>
        .
      </p>
      <div className="mt-4 flex flex-wrap gap-3">
        <Button
          type="button"
          onClick={accept}
          className="h-10 rounded-[var(--radius-md)] px-5"
        >
          Accept essential cookies
        </Button>
        <Button
          type="button"
          variant="secondary"
          render={<Link href="/cookies" />}
          className="h-10 rounded-[var(--radius-md)] px-5"
        >
          Learn more
        </Button>
      </div>
    </div>
  )
}
