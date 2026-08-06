/**
 * GET /api/cron/outbox-drain — PRD §8.6: "a Vercel Cron worker drains the
 * outbox every minute". `apps/web/vercel.json`'s `crons` entry for this
 * path uses `"* * * * *"`, so the "publish-to-searchable under 1 minute"
 * exit criterion (PRD §13's M2 row) rides on this running every minute.
 *
 * GET, not POST: Vercel Cron Jobs always invoke the configured path with
 * an HTTP GET request (Vercel's own "Securing cron jobs" and "Manage cron
 * jobs" docs both show `export function GET` handlers) — a POST-only
 * handler here would 405 on every real cron trigger and never run in
 * production. This is a deliberate deviation from a POST route; nothing
 * else about the design (auth, thin handler, envelope) changes.
 *
 * No session cookie — authorized via isAuthorizedCronRequest instead
 * (src/lib/verify-cron-request.ts), the same CRON_SECRET check Vercel's
 * own docs recommend.
 *
 * Thin per PRD §8.5: check auth, call DrainOutbox, map the result.
 */

import { NextResponse, type NextRequest } from 'next/server'

import { apiError } from '@/lib/api-error'
import { createServices } from '@/lib/composition'
import { isAuthorizedCronRequest } from '@/lib/verify-cron-request'

export async function GET(request: NextRequest): Promise<NextResponse> {
  if (!isAuthorizedCronRequest(request.headers)) {
    return apiError(
      401,
      'unauthorized',
      'This endpoint requires a valid cron secret.',
    )
  }

  const { searchSync } = createServices()

  try {
    const result = await searchSync.drainOutbox.execute()
    return NextResponse.json({ data: result })
  } catch (error) {
    console.error('GET /api/cron/outbox-drain failed:', error)
    return apiError(500, 'internal_error', 'Something went wrong on our side')
  }
}
