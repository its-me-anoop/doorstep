/**
 * Copies MapLibre GL JS's own Web Worker script and its one dependency
 * from `node_modules/maplibre-gl/dist/` into `public/vendor/maplibre-gl/`
 * — a genuine static asset Next.js serves verbatim, at a stable,
 * unhashed path — so `maplibre-adapter.ts`'s `setWorkerUrl(...)` call can
 * point at a URL that actually works in production.
 *
 * Why this exists at all (the second half of the production worker-URL
 * bug `maplibre-adapter.ts`'s own doc comment describes): pointing
 * `setWorkerUrl` at a Turbopack-asset-copied `new URL('maplibre-gl/dist/
 * maplibre-gl-worker.mjs', import.meta.url)` gets the *outer* worker
 * script itself loading correctly, but that script's own source (verified
 * directly: `grep -o 'from"[^"]*"' node_modules/maplibre-gl/dist/
 * maplibre-gl-worker.mjs`) does `import ... from "./maplibre-gl-shared.mjs"`
 * — a plain relative specifier Turbopack's asset-copy mechanism never
 * rewrites (it copies the one file you reference byte-for-byte, it
 * doesn't parse and re-bundle that file's own further imports), so the
 * worker fails a *second* time, now on that relative import
 * (`net::ERR_ABORTED` against a `_next/static/media/maplibre-gl-shared.mjs`
 * that Turbopack never emitted — confirmed by instrumenting `window.Worker`
 * in a real Playwright/Chromium run against a real `next build && next
 * start`). Serving both files verbatim, side by side, at a stable public/
 * path sidesteps this entirely: the worker's own unmodified relative
 * import resolves correctly because both files sit next to each other,
 * exactly as they do in `node_modules`.
 *
 * `maplibre-gl-shared.mjs` has no further relative imports of its own
 * (confirmed the same way) — these two files are the complete, leaf
 * dependency set the worker needs.
 *
 * Usage: `pnpm vendor:maplibre-worker`, whenever `maplibre-gl` is
 * upgraded — `scripts/assert-maplibre-worker-vendored.ts` (wired into CI)
 * fails the build if the committed copies in `public/vendor/maplibre-gl/`
 * ever drift from what's actually installed, so a forgotten re-run here
 * is caught immediately rather than silently shipping a stale/mismatched
 * worker.
 */

import { copyFileSync, existsSync, mkdirSync } from 'node:fs'
import path from 'node:path'

import {
  destDir,
  sourceDir,
  VENDORED_MAPLIBRE_FILES,
} from './maplibre-worker-paths'

function main(): void {
  const from = sourceDir()
  const to = destDir()
  mkdirSync(to, { recursive: true })

  for (const file of VENDORED_MAPLIBRE_FILES) {
    const sourcePath = path.join(from, file)
    if (!existsSync(sourcePath)) {
      console.error(
        `${sourcePath} does not exist — has maplibre-gl's own dist/ ` +
          'layout changed in an upgrade? Update VENDORED_MAPLIBRE_FILES ' +
          'in maplibre-worker-paths.ts to match.',
      )
      process.exit(1)
    }
    copyFileSync(sourcePath, path.join(to, file))
  }

  console.log(
    `Vendored ${VENDORED_MAPLIBRE_FILES.length} maplibre-gl worker file(s) ` +
      `into ${path.relative(process.cwd(), to)}.`,
  )
}

main()
