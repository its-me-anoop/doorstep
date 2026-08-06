/**
 * GET /api/cron/reindex — PRD §8.6: "a nightly full reindex reconciles
 * drift, and a count-mismatch alert catches sync bugs."
 * `apps/web/vercel.json`'s `crons` entry for this path uses `"0 3 * * *"`
 * (03:00 daily), matching services/search-sync/rebuild-search-index.ts's
 * doc comment on why a brief index-empty window at that hour is an
 * accepted trade-off.
 *
 * GET, not POST — see app/api/cron/outbox-drain/route.ts's header comment
 * for why (Vercel Cron Jobs always invoke via GET).
 *
 * No session cookie — same isAuthorizedCronRequest check as
 * outbox-drain's route (src/lib/verify-cron-request.ts).
 *
 * Thin per PRD §8.5: check auth, call RebuildSearchIndex, map the result.
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

  const { search } = createServices()

  try {
    const result = await search.rebuildSearchIndex.execute()
    return NextResponse.json({ data: result })
  } catch (error) {
    console.error('GET /api/cron/reindex failed:', error)
    return apiError(500, 'internal_error', 'Something went wrong on our side')
  }
}
