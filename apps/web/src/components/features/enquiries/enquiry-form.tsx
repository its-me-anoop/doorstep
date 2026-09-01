'use client'

import Script from 'next/script'
import { useCallback, useRef, useState } from 'react'

import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'

interface EnquiryFormProps {
  propertyId: string
  signedIn: boolean
  defaultName?: string
  defaultEmail?: string
  defaultPhone?: string | null
  turnstileSiteKey?: string
}

declare global {
  interface Window {
    turnstile?: {
      render: (
        container: HTMLElement,
        options: {
          sitekey: string
          callback: (token: string) => void
          'expired-callback'?: () => void
        },
      ) => string
      reset: (widgetId: string) => void
    }
  }
}

export function EnquiryForm({
  propertyId,
  signedIn,
  defaultName = '',
  defaultEmail = '',
  defaultPhone = null,
  turnstileSiteKey,
}: EnquiryFormProps) {
  const [name, setName] = useState(defaultName)
  const [email, setEmail] = useState(defaultEmail)
  const [phone, setPhone] = useState(defaultPhone ?? '')
  const [message, setMessage] = useState('')
  const [viewingRequested, setViewingRequested] = useState(false)
  const [status, setStatus] = useState<
    'idle' | 'submitting' | 'success' | 'error'
  >('idle')
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  const [captchaToken, setCaptchaToken] = useState<string | null>(null)
  const turnstileRef = useRef<HTMLDivElement>(null)
  const widgetIdRef = useRef<string | null>(null)

  const renderTurnstile = useCallback(() => {
    if (signedIn || !turnstileSiteKey || !turnstileRef.current) return
    if (!window.turnstile) return
    if (widgetIdRef.current) return

    widgetIdRef.current = window.turnstile.render(turnstileRef.current, {
      sitekey: turnstileSiteKey,
      callback: (token) => setCaptchaToken(token),
      'expired-callback': () => setCaptchaToken(null),
    })
  }, [signedIn, turnstileSiteKey])

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault()
    setStatus('submitting')
    setErrorMessage(null)

    try {
      const response = await fetch('/api/v1/enquiries', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          propertyId,
          name,
          email,
          phone: phone || null,
          message,
          viewingRequested,
          website: '',
          captchaToken,
        }),
      })

      if (!response.ok) {
        const body = (await response.json().catch(() => null)) as {
          error?: { message?: string }
        } | null
        throw new Error(body?.error?.message ?? 'Could not send your enquiry.')
      }

      setStatus('success')
      setMessage('')
      setViewingRequested(false)
      if (widgetIdRef.current && window.turnstile) {
        window.turnstile.reset(widgetIdRef.current)
        setCaptchaToken(null)
      }
    } catch (error) {
      setStatus('error')
      setErrorMessage(
        error instanceof Error ? error.message : 'Could not send your enquiry.',
      )
    }
  }

  if (status === 'success') {
    return (
      <p className="text-moss-500 text-sm leading-relaxed">
        Thanks — your message has been sent. The lister will reply to your
        email.
      </p>
    )
  }

  return (
    <form onSubmit={handleSubmit} className="mt-6 flex flex-col gap-4">
      <div className="sr-only" aria-hidden="true">
        <Label htmlFor="enquiry-website">Website</Label>
        <Input
          id="enquiry-website"
          name="website"
          tabIndex={-1}
          autoComplete="off"
        />
      </div>

      <div className="flex flex-col gap-1.5">
        <Label htmlFor="enquiry-name">Your name</Label>
        <Input
          id="enquiry-name"
          value={name}
          onChange={(event) => setName(event.target.value)}
          required
          autoComplete="name"
        />
      </div>

      <div className="flex flex-col gap-1.5">
        <Label htmlFor="enquiry-email">Email</Label>
        <Input
          id="enquiry-email"
          type="email"
          value={email}
          onChange={(event) => setEmail(event.target.value)}
          required
          autoComplete="email"
        />
      </div>

      <div className="flex flex-col gap-1.5">
        <Label htmlFor="enquiry-phone">Phone (optional)</Label>
        <Input
          id="enquiry-phone"
          type="tel"
          value={phone}
          onChange={(event) => setPhone(event.target.value)}
          autoComplete="tel"
        />
      </div>

      <div className="flex flex-col gap-1.5">
        <Label htmlFor="enquiry-message">Message</Label>
        <Textarea
          id="enquiry-message"
          value={message}
          onChange={(event) => setMessage(event.target.value)}
          required
          rows={4}
          minLength={10}
        />
      </div>

      <label className="flex items-center gap-2 text-sm">
        <Checkbox
          checked={viewingRequested}
          onChange={(event) => setViewingRequested(event.target.checked)}
        />
        I would like to arrange a viewing
      </label>

      {!signedIn && turnstileSiteKey && (
        <>
          <Script
            src="https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit"
            onLoad={renderTurnstile}
          />
          <div ref={turnstileRef} />
        </>
      )}

      {errorMessage && (
        <p className="text-destructive text-sm" role="alert">
          {errorMessage}
        </p>
      )}

      <Button
        type="submit"
        disabled={status === 'submitting'}
        className="h-11 w-full rounded-[var(--radius-md)]"
      >
        {status === 'submitting' ? 'Sending…' : 'Send enquiry'}
      </Button>
    </form>
  )
}
