/**
 * isAuthorizedCronRequest — the auth check shared by
 * app/api/cron/outbox-drain and app/api/cron/reindex (PRD §8.6's Vercel
 * Cron worker and nightly reindex). Fails closed: the ONLY way to pass is
 * `Authorization: Bearer ${CRON_SECRET}` — Vercel attaches this header
 * automatically to every cron-triggered request once the project has a
 * CRON_SECRET environment variable set (Vercel's own documented "Securing
 * cron jobs" pattern). CRON_SECRET is a value only this deployment and
 * Vercel's scheduler know, so a correct match is the one real security
 * boundary here.
 *
 * A previous version also accepted a bare `x-vercel-cron` header (gated
 * to NODE_ENV === 'production') as a fallback for a deployment that
 * hadn't set CRON_SECRET yet. That header is Vercel's own informational
 * marker, not a cryptographic proof — any external caller can send an
 * arbitrary header with that name — so accepting it, even
 * production-gated, meant a project that silently forgot to configure
 * CRON_SECRET in production became fully unauthenticated rather than
 * fully locked out. Removed: an unset CRON_SECRET must reject every
 * request, not degrade to a spoofable one.
 *
 * Because that misconfiguration (production, but CRON_SECRET unset) is
 * now a silent total lockout rather than a silent total bypass, it is
 * loudly logged here every time it's hit, so it surfaces in Vercel's
 * function logs immediately rather than being discovered only when the
 * outbox backlog or reindex staleness alert (PRD §7.7) eventually fires.
 * Both routes must still set CRON_SECRET in every environment that
 * matters (see .env.example).
 */

export function isAuthorizedCronRequest(
  headers: Headers,
  env: Record<string, string | undefined> = process.env,
): boolean {
  const secret = env.CRON_SECRET
  if (!secret) {
    if (env.NODE_ENV === 'production') {
      console.error(
        'isAuthorizedCronRequest: CRON_SECRET is not configured in ' +
          'production — every cron request will be rejected until it is set.',
      )
    }
    return false
  }
  return headers.get('authorization') === `Bearer ${secret}`
}
