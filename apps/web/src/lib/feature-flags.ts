/**
 * Env-driven feature flags (PRD §8.8: "Feature flags via simple
 * env-driven config for risky surfaces (map search, guest enquiry)").
 * `NEXT_PUBLIC_` because the map toggle's own render decision happens in
 * client components (results-view.tsx) as much as server ones — the flag
 * needs to be readable in the browser bundle, so it's genuinely public
 * config, not a secret.
 *
 * A kill switch, not a build-time branch: reads `process.env` at call
 * time (cheap, and Next.js inlines `process.env.NEXT_PUBLIC_*` reads at
 * build time anyway) rather than being cached in a module-level
 * constant, so the only thing that ever needs to change to disable the
 * map surface in an environment is the env var — no code path is
 * removed or dead at build time the way a literal `if (false)` would be.
 *
 * Default: **enabled**. M3's task brief states this explicitly ("default
 * enabled in dev"); production defaults to the same unless a real
 * incident calls for flipping it off, since a milestone isn't shipped
 * gated permanently — the flag exists for "turn this off quickly if it's
 * misbehaving," not "turn this on once we're ready."
 */
export function isMapFeatureEnabled(): boolean {
  return process.env.NEXT_PUBLIC_FEATURE_MAP !== 'false'
}
