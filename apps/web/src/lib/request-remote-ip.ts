import type { NextRequest } from 'next/server'

/** First hop from x-forwarded-for, else x-real-ip — for rate limits / CAPTCHA. */
export function requestRemoteIp(request: NextRequest): string | null {
  const forwarded = request.headers.get('x-forwarded-for')
  if (forwarded) {
    const first = forwarded.split(',')[0]?.trim()
    if (first) return first
  }
  return request.headers.get('x-real-ip')
}
