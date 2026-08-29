/**
 * adapters/turnstile/ — Cloudflare Turnstile CaptchaVerifier (PRD §7.4).
 *
 * When TURNSTILE_SECRET_KEY is unset, AllowAllCaptchaVerifier lets local
 * and CI flows submit guest enquiries without a real widget. Production
 * MUST set the secret; createCaptchaVerifier logs a warning when falling
 * back in NODE_ENV=production.
 */

import type { CaptchaVerifier } from '@/ports/captcha-verifier'

const SITEVERIFY_URL =
  'https://challenges.cloudflare.com/turnstile/v0/siteverify'

export class AllowAllCaptchaVerifier implements CaptchaVerifier {
  async verify(): Promise<boolean> {
    return true
  }
}

export class RejectAllCaptchaVerifier implements CaptchaVerifier {
  async verify(): Promise<boolean> {
    return false
  }
}

export class TurnstileCaptchaVerifier implements CaptchaVerifier {
  constructor(private readonly secretKey: string) {
    if (!secretKey) {
      throw new Error('TurnstileCaptchaVerifier requires a secret key')
    }
  }

  async verify(token: string, remoteIp?: string | null): Promise<boolean> {
    if (!token) return false
    try {
      const body = new URLSearchParams()
      body.set('secret', this.secretKey)
      body.set('response', token)
      if (remoteIp) body.set('remoteip', remoteIp)

      const response = await fetch(SITEVERIFY_URL, {
        method: 'POST',
        headers: { 'content-type': 'application/x-www-form-urlencoded' },
        body,
      })
      if (!response.ok) return false
      const json = (await response.json()) as { success?: boolean }
      return json.success === true
    } catch {
      return false
    }
  }
}

export function createCaptchaVerifier(): CaptchaVerifier {
  const secret = process.env.TURNSTILE_SECRET_KEY
  if (secret) return new TurnstileCaptchaVerifier(secret)
  if (process.env.NODE_ENV === 'production') {
    console.warn(
      'createCaptchaVerifier: TURNSTILE_SECRET_KEY unset in production — guest captcha is AllowAll (fail-open for boot). Set the secret before beta traffic.',
    )
  }
  return new AllowAllCaptchaVerifier()
}
