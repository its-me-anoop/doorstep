'use client'

import Link from 'next/link'
import { useEffect, useState } from 'react'

import { Button } from '@/components/ui/button'

const STORAGE_KEY = 'doorstep-cookie-consent'

/**
 * Essential-only cookie banner until the visitor accepts analytics
 * preferences (M6). Stores choice in localStorage.
 */
export function CookieConsentBanner() {
  const [visible, setVisible] = useState(false)

  useEffect(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY)
      if (!stored) setVisible(true)
    } catch {
      setVisible(true)
    }
  }, [])

  function accept() {
    try {
      localStorage.setItem(STORAGE_KEY, 'essential')
    } catch {
      // ignore quota errors
    }
    setVisible(false)
  }

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
        <Link href="/cookies" className="text-primary underline-offset-2 hover:underline">
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
