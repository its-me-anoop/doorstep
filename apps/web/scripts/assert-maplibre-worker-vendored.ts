/**
 * CI assertion (`.github/workflows/ci.yml`'s `build` job, alongside
 * `assert-map-bundle-isolation.ts`): fails loudly if the committed
 * `public/vendor/maplibre-gl/*` files ever drift from
 * `node_modules/maplibre-gl/dist/*` — the failure mode being guarded
 * against is a `maplibre-gl` version bump that forgets to re-run
 * `pnpm vendor:maplibre-worker` (`scripts/vendor-maplibre-worker.ts`),
 * silently leaving production pointed at a stale worker script that may
 * no longer match the rest of the (freshly upgraded) library it's paired
 * with — exactly the kind of silent map breakage this whole fix exists to
 * prevent in the first place.
 *
 * A byte-for-byte comparison, not a version-string check: these files
 * carry no independent version field of their own (they're a build
 * output, not a package), and a byte diff is the only thing that
 * precisely answers "would `pnpm vendor:maplibre-worker` change
 * anything?" without re-deriving that script's own copy logic here.
 *
 * Usage: `pnpm assert:maplibre-worker-vendored` (no build required first
 * — this only reads `node_modules` and the committed `public/` files).
 */

import { readFileSync } from 'node:fs'
import path from 'node:path'

import {
  destDir,
  sourceDir,
  VENDORED_MAPLIBRE_FILES,
} from './maplibre-worker-paths'

function main(): void {
  const from = sourceDir()
  const to = destDir()
  const stale: string[] = []

  for (const file of VENDORED_MAPLIBRE_FILES) {
    const installed = readFileSync(path.join(from, file))
    const vendored = readFileSync(path.join(to, file))
    if (!installed.equals(vendored)) stale.push(file)
  }

  if (stale.length > 0) {
    console.error(
      'The vendored maplibre-gl worker file(s) are out of date with the ' +
        `installed maplibre-gl package: ${stale.join(', ')}. Run ` +
        '"pnpm vendor:maplibre-worker" and commit the result.',
    )
    process.exit(1)
  }

  console.log(
    `Vendored maplibre-gl worker files are up to date (${VENDORED_MAPLIBRE_FILES.length} checked).`,
  )
}

main()
