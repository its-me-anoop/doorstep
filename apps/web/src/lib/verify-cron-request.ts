/**
 * isAuthorizedCronRequest — the auth check shared by
 * app/api/cron/outbox-drain and app/api/cron/reindex (PRD §8.6's Vercel
 * Cron worker and nightly reindex). Two independent ways to pass:
 *
 *  1. `Authorization: Bearer ${CRON_SECRET}` — Vercel attaches this header
 *     automatically to every cron-triggered request once the project has
 *     a CRON_SECRET environment variable set (Vercel's own documented
 *     "Securing cron jobs" pattern). This is the real security boundary:
 *     CRON_SECRET is a value only this deployment and Vercel's scheduler
 *     know, so a correct match proves the request came from the
 *     configured cron trigger and not an arbitrary caller.
 *  2. `x-vercel-cron` header present, but ONLY when NODE_ENV is
 *     'production'. Vercel's edge sets this header on cron-triggered
 *     requests as an informational marker, not a cryptographic proof —
 *     any caller can send an arbitrary header with that name, so this
 *     path is intentionally the weaker of the two and exists only as a
 *     fallback for a production deployment that has not (yet) set
 *     CRON_SECRET. It is gated to production so a local dev server or a
 *     preview deploy can never be tricked into treating a hand-crafted
 *     header as an authorized cron call — CRON_SECRET is the only path
 *     that works anywhere else.
 *
 * Both routes should still set CRON_SECRET in every environment that
 * matters (see .env.example) — path 2 is deliberately the fallback, not
 * the recommended configuration.
 */

export function isAuthorizedCronRequest(
  headers: Headers,
  env: Record<string, string | undefined> = process.env,
): boolean {
  const secret = env.CRON_SECRET
  if (secret && headers.get('authorization') === `Bearer ${secret}`) {
    return true
  }
  return env.NODE_ENV === 'production' && headers.has('x-vercel-cron')
}
