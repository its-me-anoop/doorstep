/**
 * The session cookie's name. Split into its own tiny module so proxy.ts
 * can read it without pulling in lib/session.ts's dependency chain
 * (lib/composition.ts -> Drizzle, firebase-admin) — proxy.ts runs on
 * every matched navigation and has no business bundling either.
 */
export const SESSION_COOKIE_NAME =
  process.env.SESSION_COOKIE_NAME?.trim() || '__session'
