/**
 * scripts/search-bench.ts — M2 exit-criterion evidence (PRD §13: "p75
 * search under 500 ms"). Fires N=300 (configurable via --n=) mixed,
 * realistic GET /api/v1/search requests against a running server
 * (BASE_URL, default http://127.0.0.1:3005 — the reserved manual-check
 * port this repo's conventions use, since 3000/3001 are reserved) and
 * prints p50/p75/p95/p99 latency plus an error count.
 *
 * Starts nothing itself — no dev server, no reindex. It DOES check
 * SearchIndex.healthy() first (adapters/meilisearch, same MEILISEARCH_HOST
 * env as the server it's about to query) and fails fast with a clear
 * message if Meilisearch isn't reachable, rather than firing 300 requests
 * that would all just 503. It deliberately does NOT call the shared
 * RebuildSearchIndex here — see scripts/seed-search-5k.ts's header
 * comment for why that full-corpus rebuild can throw in this environment
 * independently of anything this script does; scripts/seed-search-5k.ts
 * already indexes the 5k directly as part of seeding, so re-indexing here
 * would be redundant even if it were safe to call.
 *
 * Concurrency is bounded (DEFAULT_CONCURRENCY) rather than fully
 * sequential or fully parallel: sequential would understate real
 * multi-client load, and 300 simultaneous requests would just measure
 * this script's own local network/event-loop contention rather than the
 * server's, and are also not realistic. lib/concurrency-limit.ts's
 * runWithConcurrencyLimit already implements exactly this shape.
 *
 * No live server on this development machine to run this against without
 * manual setup — see the M2 task brief's own "RUN IT locally" steps.
 * This file's pure query-generation and percentile-math halves
 * (scripts/search-bench-queries.ts) are unit-tested; this shell's own
 * shape is covered by `pnpm typecheck`.
 */

import { MeilisearchSearchIndex } from '@/adapters/meilisearch'
import { runWithConcurrencyLimit } from '@/lib/concurrency-limit'

import { buildBenchQueries, percentile } from './search-bench-queries'

const DEFAULT_N = 300
const DEFAULT_CONCURRENCY = 10
const DEFAULT_BASE_URL = 'http://127.0.0.1:3005'

function parseArgs(): { n: number; concurrency: number; baseUrl: string } {
  const args = process.argv.slice(2)
  const nArg = args.find((a) => a.startsWith('--n='))
  const concurrencyArg = args.find((a) => a.startsWith('--concurrency='))
  return {
    n: nArg ? Number.parseInt(nArg.slice('--n='.length), 10) : DEFAULT_N,
    concurrency: concurrencyArg
      ? Number.parseInt(concurrencyArg.slice('--concurrency='.length), 10)
      : DEFAULT_CONCURRENCY,
    baseUrl: process.env.BASE_URL ?? DEFAULT_BASE_URL,
  }
}

interface QueryOutcome {
  latencyMs: number
  ok: boolean
}

async function runQuery(
  baseUrl: string,
  params: URLSearchParams,
): Promise<QueryOutcome> {
  const start = performance.now()
  try {
    const response = await fetch(
      `${baseUrl}/api/v1/search?${params.toString()}`,
    )
    const latencyMs = performance.now() - start
    return { latencyMs, ok: response.ok }
  } catch {
    return { latencyMs: performance.now() - start, ok: false }
  }
}

function printReport(outcomes: QueryOutcome[]): void {
  const latencies = outcomes.map((o) => o.latencyMs)
  const errors = outcomes.filter((o) => !o.ok).length

  console.log('')
  console.log('GET /api/v1/search bench results')
  console.log('---------------------------------')
  console.log(`requests: ${outcomes.length}`)
  console.log(`errors:   ${errors}`)
  console.log('')
  console.log('percentile | latency (ms)')
  console.log('-----------|-------------')
  for (const p of [50, 75, 95, 99]) {
    console.log(
      `p${p}`.padEnd(11, ' ') + '| ' + percentile(latencies, p).toFixed(1),
    )
  }
  console.log('')
}

async function main(): Promise<void> {
  const { n, concurrency, baseUrl } = parseArgs()

  console.log('Checking Meilisearch is reachable...')
  const searchIndex = new MeilisearchSearchIndex()
  if (!(await searchIndex.healthy())) {
    console.error(
      'Meilisearch is not reachable (MEILISEARCH_HOST). Start it before running this bench.',
    )
    process.exit(1)
  }

  console.log(
    `Firing ${n} queries at ${baseUrl} (concurrency ${concurrency})...`,
  )
  const queries = buildBenchQueries(n)
  const outcomes = await runWithConcurrencyLimit(
    queries,
    concurrency,
    (params) => runQuery(baseUrl, params),
  )

  printReport(outcomes)
}

main().catch((error: unknown) => {
  console.error('search-bench.ts failed:', error)
  process.exit(1)
})
