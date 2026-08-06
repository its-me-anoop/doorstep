/**
 * Shared, side-effect-free constants for `vendor-maplibre-worker.ts` and
 * `assert-maplibre-worker-vendored.ts` — kept in their own module rather
 * than one script importing the other's, so importing this file never
 * triggers either script's own `main()` (each of those two is a CLI
 * entry point in its own right, meant to be run directly, not imported).
 */

import path from 'node:path'

export const VENDORED_MAPLIBRE_FILES = [
  'maplibre-gl-worker.mjs',
  'maplibre-gl-shared.mjs',
] as const

export function sourceDir(): string {
  return path.join(process.cwd(), 'node_modules', 'maplibre-gl', 'dist')
}

export function destDir(): string {
  return path.join(process.cwd(), 'public', 'vendor', 'maplibre-gl')
}
