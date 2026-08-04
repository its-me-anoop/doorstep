'use client'

import { Apple } from 'lucide-react'
import { useRouter } from 'next/navigation'
import { useState } from 'react'

import { Button } from '@/components/ui/button'
import {
  mapFirebaseAuthError,
  type AuthErrorPresentation,
} from '@/lib/auth-error-messages'
import { signInWithApple, signInWithGoogle } from '@/lib/firebase-client'

import { finishSignIn } from './finish-sign-in'
import { GoogleGlyph } from './google-glyph'

type Provider = 'google' | 'apple'

interface OAuthButtonsProps {
  nextPath: string
  onError: (presentation: AuthErrorPresentation | null) => void
}

/**
 * Google then Apple, full-width, stacked (never side-by-side — that
 * halves the tap target on mobile), each using the provider's own
 * official button convention rather than a custom pill (DESIGN-SPEC.md
 * §4 — an OAuth button is a trust surface). Identical for sign-in and
 * sign-up: Firebase's popup sign-in creates the account on first use,
 * so there is nothing sign-up-specific about this component.
 */
export function OAuthButtons({ nextPath, onError }: OAuthButtonsProps) {
  const router = useRouter()
  const [pendingProvider, setPendingProvider] = useState<Provider | null>(null)

  async function handle(provider: Provider) {
    setPendingProvider(provider)
    onError(null)
    try {
      const credential =
        provider === 'google'
          ? await signInWithGoogle()
          : await signInWithApple()
      await finishSignIn(credential, router, nextPath)
    } catch (error) {
      const presentation = mapFirebaseAuthError(error)
      if (!presentation.silent) onError(presentation)
      setPendingProvider(null)
    }
  }

  const disabled = pendingProvider !== null

  return (
    <div className="flex flex-col gap-3">
      <Button
        type="button"
        variant="outline"
        onClick={() => handle('google')}
        aria-disabled={disabled}
        className="border-input text-foreground h-11 w-full justify-center gap-2.5 rounded-[var(--radius-md)] bg-white hover:bg-white"
      >
        <GoogleGlyph className="size-4" />
        {pendingProvider === 'google' ? 'Connecting…' : 'Continue with Google'}
      </Button>
      {/* #000 is the one permitted exception to "never pure black" — it is
          Apple's mandated Sign in with Apple brand asset, not a Doorstep
          token (DESIGN-SPEC.md §4). */}
      <Button
        type="button"
        onClick={() => handle('apple')}
        aria-disabled={disabled}
        className="h-11 w-full justify-center gap-2.5 rounded-[var(--radius-md)] bg-black text-white hover:bg-black"
      >
        <Apple className="size-4" aria-hidden="true" />
        {pendingProvider === 'apple' ? 'Connecting…' : 'Continue with Apple'}
      </Button>
    </div>
  )
}
