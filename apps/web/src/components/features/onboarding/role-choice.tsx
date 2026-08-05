'use client'

import { useRouter } from 'next/navigation'
import { useState } from 'react'

import { becomeOwner, OnboardingApiError } from '@/lib/onboarding-client'

import { finishOnboarding } from './finish-onboarding'
import { RoleOption } from './role-option'

const GENERIC_ERROR = 'Something went wrong on our end — try again in a moment.'

/**
 * RoleChoice — M1-DESIGN-SPEC.md §2.1's role-choice screen. Two rows, no
 * "Continue" button: each row is a single committing action, since the
 * two destinations genuinely differ (instant grant vs. a form) and a
 * second confirmation click on an already-unambiguous choice is friction
 * without payoff (§2.1's own reasoning).
 *
 * No third "join an agency I've been invited to" row — deliberately
 * deferred past M1, and per the account page's own precedent (M0), a
 * disabled/greyed stub for it would be noise, not progressive
 * disclosure.
 */
export function RoleChoice() {
  const router = useRouter()
  const [pending, setPending] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function selectOwner() {
    if (pending) return
    setPending(true)
    setError(null)
    try {
      await becomeOwner()
      await finishOnboarding(router)
    } catch (err) {
      setError(err instanceof OnboardingApiError ? err.message : GENERIC_ERROR)
      setPending(false)
    }
  }

  function selectAgent() {
    if (pending) return
    router.push('/onboarding/agency')
  }

  return (
    <div className="flex flex-col gap-8">
      <h1 className="text-[length:var(--text-h1)] leading-[1.12]">
        How would you like to list?
      </h1>

      <div className="flex flex-col gap-4">
        <RoleOption
          heading="I&rsquo;m a private owner or landlord"
          description="List your own home or rental. We&rsquo;ll guide you through everything a legal listing needs, EPC included. Every listing is still checked by a person before it goes live."
          onSelect={selectOwner}
          pending={pending}
          pendingLabel="Setting up your account…"
          disabled={pending}
        />
        <RoleOption
          heading="I&rsquo;m an agent"
          description="Create your agency profile — logo, contact details and branch address. Free while we build supply in Reading."
          onSelect={selectAgent}
          disabled={pending}
        />
      </div>

      {error && (
        <p role="alert" className="opacity-transition text-destructive text-sm">
          {error}
        </p>
      )}
    </div>
  )
}
