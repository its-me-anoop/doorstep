/**
 * CI assertion (PRD §7.1: "search list route ships without [the map
 * bundle]" — the second half of M3's exit criterion, structurally
 * encoded rather than eyeballed off a bundle-size diff): run *after*
 * `next build`, this reads each list-tier route's own App Router client
 * reference manifest (`.next/server/app/**\/page_client-reference-manifest.js`
 * — the exact file Next.js itself uses to decide which client chunks a
 * page's initial render needs; see results-view.tsx's own doc comment on
 * `next/dynamic(..., { ssr: false })` for why the map bundle is a
 * client-side code-split point this manifest is expected to have no
 * knowledge of at all) and asserts none of the chunk files it
 * references contain the MapLibre/Mapbox GL libraries.
 *
 * A pure content-string check (`maplibre-gl`/`mapbox-gl`), not a chunk
 * *count* or *size* diff: those libraries' own package names survive
 * production minification as string literals (constructor names,
 * internal error messages, telemetry headers) even though every local
 * identifier is mangled — confirmed empirically against this repo's own
 * build before writing the assertion below (grep -l maplibre-gl
 * .next/static/chunks/*.js finds the real map chunk; every list-route
 * chunk comes back clean).
 *
 * Deliberately includes a *positive* control (`assertMapChunkExistsSomewhere`):
 * without it, a broken build, a renamed manifest file, or a future
 * Next.js version moving where chunk references live would make this
 * script's main assertion pass vacuously — "found zero matches" is only
 * meaningful once something has proven the search mechanism itself can
 * find a real match when one genuinely exists.
 *
 * Usage: `pnpm build && pnpm assert:map-bundle-isolation` (wired into
 * .github/workflows/ci.yml's `build` job, right after the `next build`
 * step, reusing that job's own `.next` output rather than building a
 * second time).
 */

import { existsSync, readdirSync, readFileSync } from 'node:fs'
import path from 'node:path'

const NEXT_DIR = path.join(process.cwd(), '.next')

/** M3-DESIGN-SPEC.md §1.9 / PRD §13: every route the map toggle can
 * appear on — the exact set the M3 phase report's own bundle-size table
 * measured. `(public)` matches the App Router route group directory
 * `.next/server/app/` mirrors on disk; dynamic segments keep their
 * literal `[area]` folder name (confirmed against a real build, not
 * assumed). */
const LIST_ROUTE_DIRS = [
  '(public)/for-sale',
  '(public)/for-sale/[area]',
  '(public)/for-sale/search',
  '(public)/to-rent',
  '(public)/to-rent/[area]',
  '(public)/to-rent/search',
]

const MAP_LIBRARY_PATTERN = /maplibre-gl|mapbox-gl/i

interface Violation {
  route: string
  chunkPath: string
}

/** Extracts the `RSC_MANIFEST` object a `page_client-reference-manifest.js`
 * file assigns to `globalThis.__RSC_MANIFEST["<route key>"]` — the file
 * is a plain script (not JSON) that does that one assignment, so a
 * regex anchored on the `= {...}` tail is enough to recover the object
 * literal without needing a JS parser. The route key itself is matched
 * as `".*?"` (any quoted string), not `\[[^\]]+\]` — a dynamic-segment
 * route's key (e.g. `"/(public)/for-sale/[area]/page"`) contains its
 * own literal `]`, which a naive "stop at the first `]`" character class
 * truncates on before reaching the real end of the index expression. */
function readClientReferenceManifest(
  filePath: string,
): { clientModules: Record<string, { chunks?: string[] }> } | null {
  const raw = readFileSync(filePath, 'utf8')
  const match =
    /globalThis\.__RSC_MANIFEST\[".*?"\]\s*=\s*(\{[\s\S]*\});?\s*$/.exec(raw)
  if (!match) return null
  return JSON.parse(match[1]) as {
    clientModules: Record<string, { chunks?: string[] }>
  }
}

/** Every chunk path a route's own client reference manifest lists —
 * exactly what Next.js injects as modulepreload/script tags to hydrate
 * that route, per its own doc comment above. */
function chunksReferencedByRoute(routeDir: string): string[] {
  const manifestPath = path.join(
    NEXT_DIR,
    'server',
    'app',
    routeDir,
    'page_client-reference-manifest.js',
  )
  if (!existsSync(manifestPath)) {
    throw new Error(
      `No client reference manifest found for route "${routeDir}" at ` +
        `${manifestPath} — has the app's route structure changed? Update ` +
        `LIST_ROUTE_DIRS in this script to match.`,
    )
  }
  const manifest = readClientReferenceManifest(manifestPath)
  if (!manifest) {
    throw new Error(
      `Could not parse the RSC client reference manifest at ${manifestPath} ` +
        `— its format may have changed in a Next.js upgrade.`,
    )
  }
  const chunks = new Set<string>()
  for (const clientModule of Object.values(manifest.clientModules)) {
    for (const chunk of clientModule.chunks ?? []) chunks.add(chunk)
  }
  return [...chunks]
}

function chunkFileContainsMapLibrary(chunkUrl: string): boolean {
  // Chunk URLs are absolute site paths, e.g. "/_next/static/chunks/x.js"
  // — "_next" is this same ".next" build output directory as served.
  const relativePath = chunkUrl.replace(/^\/_next\//, '')
  const filePath = path.join(NEXT_DIR, relativePath)
  if (!existsSync(filePath)) {
    throw new Error(
      `Route manifest referenced chunk "${chunkUrl}" but ${filePath} does ` +
        `not exist on disk — an inconsistent .next build.`,
    )
  }
  return MAP_LIBRARY_PATTERN.test(readFileSync(filePath, 'utf8'))
}

/** The positive control — see this file's own header comment. Scans
 * every chunk actually written to `.next/static/chunks` (Turbopack's
 * flat chunk directory in this build), not just the list routes' own
 * referenced subset, so it stays meaningful independent of which routes
 * this script otherwise checks. */
function assertMapChunkExistsSomewhere(): void {
  const chunksDir = path.join(NEXT_DIR, 'static', 'chunks')
  if (!existsSync(chunksDir)) {
    throw new Error(
      `${chunksDir} does not exist — run "pnpm build" before this script.`,
    )
  }
  const found = readdirSync(chunksDir).some((file) => {
    if (!file.endsWith('.js')) return false
    return MAP_LIBRARY_PATTERN.test(
      readFileSync(path.join(chunksDir, file), 'utf8'),
    )
  })
  if (!found) {
    throw new Error(
      'Positive-control check failed: no chunk anywhere under ' +
        `${chunksDir} contains "maplibre-gl"/"mapbox-gl". Either the map ` +
        'feature was removed, or this build genuinely never bundled it — ' +
        'either way, the "list routes reference none of it" assertion ' +
        'below would be vacuous, so this script refuses to proceed.',
    )
  }
}

function main(): void {
  if (!existsSync(NEXT_DIR)) {
    console.error(
      `${NEXT_DIR} does not exist. Run "pnpm build" before ` +
        'assert:map-bundle-isolation.',
    )
    process.exit(1)
  }

  assertMapChunkExistsSomewhere()

  const violations: Violation[] = []
  let totalChunksChecked = 0

  for (const routeDir of LIST_ROUTE_DIRS) {
    const chunks = chunksReferencedByRoute(routeDir)
    totalChunksChecked += chunks.length
    for (const chunk of chunks) {
      if (chunkFileContainsMapLibrary(chunk)) {
        violations.push({ route: routeDir, chunkPath: chunk })
      }
    }
  }

  if (violations.length > 0) {
    console.error(
      'Map bundle isolation FAILED — the following list-route chunks ' +
        'reference the MapLibre/Mapbox GL bundle (PRD §7.1: the list ' +
        'route must ship without it):',
    )
    for (const { route, chunkPath } of violations) {
      console.error(`  ${route} -> ${chunkPath}`)
    }
    process.exit(1)
  }

  console.log(
    `Map bundle isolation OK: checked ${totalChunksChecked} chunk ` +
      `reference(s) across ${LIST_ROUTE_DIRS.length} list route(s) — none ` +
      'reference maplibre-gl or mapbox-gl.',
  )
}

main()
