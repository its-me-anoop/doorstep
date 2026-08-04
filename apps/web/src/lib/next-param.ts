/**
 * sanitizeNextPath — validates the `?next=` redirect target used by the
 * sign-in/sign-up flows (post-auth `router.push(next)`) and by proxy.ts's
 * gate redirects (lib/decide-gate.ts). Never trust a query param as a
 * navigation target verbatim: an attacker-controlled `next` value is a
 * classic open-redirect vector, so anything that isn't unambiguously a
 * same-origin relative path falls back to a safe default.
 *
 * Deliberately conservative rather than clever — a false-negative here
 * (a legitimate relative path rejected) just sends the user to the
 * fallback instead of where they came from; a false-positive (an
 * attacker path accepted) sends them off-site. The asymmetry means this
 * only needs to be permissive enough for this app's own routes.
 */
export function sanitizeNextPath(
  candidate: string | null | undefined,
  fallback = '/account',
): string {
  if (!candidate) return fallback

  // Must start with exactly one '/' — rules out absolute URLs
  // (`https://evil.example`), bare paths without a leading slash, and
  // protocol-relative URLs (`//evil.example`, `///evil.example`), all of
  // which browsers/routers can resolve to a different origin.
  if (!candidate.startsWith('/') || candidate.startsWith('//')) {
    return fallback
  }

  // Backslashes are normalised to forward slashes by some browsers and by
  // the WHATWG URL parser, so `/\evil.example` and `\/evil.example` can
  // both become protocol-relative URLs downstream even though neither
  // looks like one here.
  if (candidate.includes('\\')) return fallback

  // Control characters (tabs, newlines, etc.) are stripped by some URL
  // parsers, which can turn an otherwise-blocked scheme like
  // `/<TAB>javascript:alert(1)` into something browsers execute. Checked
  // by character code, not a regex literal, to avoid embedding raw
  // control bytes in this source file.
  if (containsControlCharacter(candidate)) return fallback

  return candidate
}

function containsControlCharacter(value: string): boolean {
  for (let i = 0; i < value.length; i += 1) {
    const code = value.charCodeAt(i)
    const isC0 = code <= 31
    const isDelete = code === 127
    if (isC0 || isDelete) return true
  }
  return false
}
