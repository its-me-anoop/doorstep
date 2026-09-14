/**
 * The real `Embedder` behind `semantic-hints.ts`: Transformers.js
 * running `Xenova/all-MiniLM-L6-v2` (8-bit quantised, ~23 MB) in the
 * visitor's browser on the WebAssembly backend. Free, no API key, and
 * the query text never leaves the device — the only network traffic is
 * the one-off download of the library and model weights, which the
 * browser then caches (Transformers.js writes model files to the Cache
 * API; the CDN sets long-lived immutable headers on the pinned bundle).
 *
 * Why a CDN import rather than an npm dependency: `@huggingface/
 * transformers` pulls in `onnxruntime-node` (a native binary with a
 * post-install download that pnpm 11's build-script gate would block in
 * CI — see pnpm-workspace.yaml's own comment on `allowBuilds`) and
 * `sharp`, and needs bundler configuration to keep the Node backend out
 * of the client bundle. None of that is needed to run a small model in a
 * browser. The `webpackIgnore` magic comment (honoured by both webpack
 * and Turbopack, node_modules/next/dist/docs/01-app/02-guides/
 * lazy-loading.md) leaves the `import()` as a genuine runtime dynamic
 * import, so the library is fetched only when — and if — this function
 * is first called, and contributes nothing to the app's own bundles.
 *
 * Every failure mode (no WebAssembly, CDN unreachable, model download
 * rejected, an incompatible library version) resolves to `null` rather
 * than throwing: the caller (`use-semantic-hints.ts`) simply never shows
 * suggestion chips, and the rule-based parser remains the whole feature.
 */

import { isNlSearchAiEnabled } from '@/lib/feature-flags'
import type { Embedder } from '@/lib/nl-search/semantic-hints'

/** Pinned so a CDN-side release can never change behaviour under us; the
 * thresholds in semantic-hints.ts are calibrated against this exact
 * model + library pair. */
export const TRANSFORMERS_CDN_URL =
  'https://cdn.jsdelivr.net/npm/@huggingface/transformers@3.8.1'
export const EMBEDDING_MODEL_ID = 'Xenova/all-MiniLM-L6-v2'

/** The tiny slice of Transformers.js's surface this module touches —
 * typed by hand because the library is not a compile-time dependency. */
interface TransformersModule {
  env: {
    allowLocalModels: boolean
    backends?: {
      onnx?: {
        wasm?: { numThreads?: number }
      }
    }
  }
  pipeline: (
    task: 'feature-extraction',
    model: string,
    options: { dtype: 'q8' },
  ) => Promise<FeatureExtractionPipeline>
}

interface FeatureExtractionPipeline {
  (
    texts: string[],
    options: { pooling: 'mean'; normalize: true },
  ): Promise<{ tolist(): number[][] }>
}

interface NavigatorWithConnection extends Navigator {
  connection?: { saveData?: boolean }
}

/**
 * Cheap, synchronous pre-flight: is it even worth trying to load the
 * model here? `false` for server renders, browsers without WebAssembly,
 * visitors who've asked for reduced data use, and when the flag is off.
 */
export function isOnDeviceAiAvailable(): boolean {
  if (!isNlSearchAiEnabled()) return false
  if (typeof window === 'undefined') return false
  if (typeof WebAssembly === 'undefined') return false
  const connection = (navigator as NavigatorWithConnection).connection
  if (connection?.saveData) return false
  return true
}

let embedderPromise: Promise<Embedder | null> | undefined

/**
 * Loads (once) and returns the on-device embedder, or `null` when it
 * can't be had. Safe to call repeatedly — every caller shares one load.
 * The dynamic import is deliberately of a *variable* holding the URL,
 * not a literal, so no bundler can be tempted to resolve it at build
 * time even without the magic comment.
 */
export function loadOnDeviceEmbedder(): Promise<Embedder | null> {
  if (!isOnDeviceAiAvailable()) return Promise.resolve(null)
  if (!embedderPromise) {
    embedderPromise = createEmbedder().catch((error: unknown) => {
      console.warn('Plain-English search: on-device model unavailable', error)
      // Let a later call retry (a transient network failure shouldn't
      // disable the layer for the whole session).
      embedderPromise = undefined
      return null
    })
  }
  return embedderPromise
}

async function createEmbedder(): Promise<Embedder> {
  const url = TRANSFORMERS_CDN_URL
  const transformers = (await import(
    /* webpackIgnore: true */ url
  )) as TransformersModule
  transformers.env.allowLocalModels = false
  // Multi-threaded WASM needs SharedArrayBuffer, which needs the page to
  // be cross-origin isolated (COOP/COEP headers) — it isn't, so
  // onnxruntime would only ever fall back to one thread anyway. Saying
  // so up front makes the configuration honest rather than incidental;
  // one thread is plenty for a 22M-parameter model on a handful of
  // short phrases. (Chrome still logs an "Issues"-tab notice because
  // onnxruntime's own loader script *references* SharedArrayBuffer; that
  // is theirs, not a failure.)
  const wasm = transformers.env.backends?.onnx?.wasm
  if (wasm) wasm.numThreads = 1
  const extractor = await transformers.pipeline(
    'feature-extraction',
    EMBEDDING_MODEL_ID,
    { dtype: 'q8' },
  )
  return async (texts) => {
    const output = await extractor(texts, { pooling: 'mean', normalize: true })
    return output.tolist()
  }
}

/** Test seam: forgets the shared load so a later call starts afresh. */
export function resetOnDeviceEmbedderForTests(): void {
  embedderPromise = undefined
}
