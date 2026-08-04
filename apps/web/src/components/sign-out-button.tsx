'use client'

import { useRouter } from 'next/navigation'
import { useState } from 'react'

import { signOutEverywhere } from '@/lib/firebase-client'
import { cn } from '@/lib/utils'

/**
 * Deliberately a plain text button, not the shared <Button> primitive
 * and not --destructive-coloured — signing out isn't dangerous, and the
 * design spec is explicit that this shouldn't "cry wolf" with colour
 * (DESIGN-SPEC.md §5). Shared between the site header (signed-in state)
 * and the account page.
 */
export function SignOutButton({ className }: { className?: string }) {
  const router = useRouter()
  const [pending, setPending] = useState(false)

  async function handleClick() {
    setPending(true)
    try {
      await signOutEverywhere()
    } finally {
      router.push('/')
      router.refresh()
    }
  }

  return (
    <button
      type="button"
      onClick={handleClick}
      aria-disabled={pending}
      className={cn(
        'text-muted-foreground hover:text-foreground text-sm transition-colors disabled:pointer-events-none disabled:opacity-60',
        className,
      )}
    >
      {pending ? 'Signing out…' : 'Sign out'}
    </button>
  )
}
