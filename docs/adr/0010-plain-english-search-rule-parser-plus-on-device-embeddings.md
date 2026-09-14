# ADR-0010: Plain-English search — a rule-based parser as the core, an on-device embedding model as an optional layer, no hosted LLM

## Status

Accepted.

## Context

Buyers and renters describe what they want in a sentence ("2 bed flat in
Reading under £350k with parking") but the search surface asks for a
postcode, then a filter bar. Translating the sentence into the existing
search state is a genuinely useful "AI" feature — and the obvious way to
build it (send the sentence to a hosted LLM and ask for JSON) was ruled
out up front: no OpenAI/Anthropic key exists in any environment, PRD §14's
running-costs table has no line for per-query inference, and every
visitor's free-text search would become a third-party data flow to
disclose under the privacy policy.

Two facts shape what a free alternative can look like:

- The target vocabulary is small and closed. `SearchUrlState`
  (`lib/search-url.ts`) has a dozen fields — price bounds, bed bounds,
  eight property types, three furnishing values, a date, a sort, a view,
  a point + radius. Almost everything a visitor says about *these* is
  said in a handful of highly regular ways ("2 bed", "under £350k",
  "pcm", "semi-detached"), which rules handle exactly and instantly.
- What rules can't handle is open vocabulary: "barn conversion",
  "somewhere with no stairs for my mum", "room for the car". This is the
  one place a learned model earns its keep — and it only needs to map a
  short phrase onto the same small closed set, not generate anything.

## Decision

1. **A pure TypeScript parser is the feature** (`lib/nl-search/parse.ts`).
   Deterministic, synchronous, unit-tested against a corpus of UK
   phrasings, no network. It emits a `SearchUrlState` subset plus an
   honest `unsupported` list for wishes the product has no filter for
   yet (parking, garden, pets, bathroom counts) — surfaced to the
   visitor, never silently dropped or faked. Whatever it can't explain is
   returned as `residualFragments`.

2. **Navigation reuses the existing URL layer** (`lib/nl-search/navigation.ts`).
   Place text is geocoded through the existing `/api/v1/geocode` route
   (ADR-0007's postcodes.io fallback, no new billing); the area-page vs
   `/search`-tier decision is `searchTargetForGeocodeSuggestion`; a Buy →
   Rent switch is `resetStateForChannelSwitch`; serialisation is
   `buildSearchHref`. A plain-English search can therefore only ever
   produce a URL the ordinary filter bar could have.

3. **An on-device sentence-embedding model is an optional layer on top**
   (`lib/nl-search/semantic-hints.ts`, `on-device-embedder.ts`). Residual
   fragments are classified by nearest prototype in embedding space
   (`Xenova/all-MiniLM-L6-v2`, 8-bit, ~23 MB) against hand-written
   prototype phrases per property type and per unsupported wish, with a
   calibrated similarity floor and runner-up margin so it abstains rather
   than guess. The model runs in the visitor's browser on Transformers.js's
   WebAssembly backend; the query never leaves the device. Anything it
   finds is shown as a marked **suggested** chip the visitor can dismiss
   before searching.

4. **Transformers.js is loaded from a pinned CDN URL at runtime, not
   installed as an npm dependency.** `@huggingface/transformers` pulls in
   `onnxruntime-node` (a native binary whose post-install download
   pnpm 11's build-script gate would block in CI) and `sharp`, and needs
   bundler configuration to keep the Node backend out of client bundles
   — none of which is needed to run a small model in a browser. A
   `webpackIgnore`d dynamic `import()` of a variable URL leaves the
   library entirely out of the app's own bundles and fetches it only on
   first use.

5. **Lazy, gated, and always degradable.** The model is only ever
   requested once a visitor has opened the plain-English box *and* typed
   something the rules couldn't explain. It is skipped when WebAssembly
   is absent, when the visitor has data-saver on, or when
   `NEXT_PUBLIC_FEATURE_NL_SEARCH_AI=false`; a failed load resolves to
   `null` and is not retried within the session. In every one of those
   cases the parser alone is the feature — no chip is missing except the
   "suggested" ones.

## Consequences

- Zero marginal cost per search and no new secrets in any environment.
  The only new network dependencies are two public CDNs (jsDelivr for the
  library, the Hugging Face Hub for model weights), both hit at most
  once per browser and then served from the browser's own cache.
- Two layers means two failure modes to keep honest: the parser can
  mis-read (mitigated by showing chips before applying, and by the
  dismiss affordance); the model can mis-suggest (mitigated by the
  abstention thresholds, the "suggested" marking, and by a rule-found
  type always taking precedence over a suggested one).
- The thresholds in `semantic-hints.ts` are tied to this exact model +
  prototype set; changing either means re-calibrating (the module's doc
  comment records the calibration corpus's key numbers).
- ~23 MB on first use is a real cost for the minority of visitors who
  reach the residual path on a metered connection. The data-saver
  check and the "only after unexplained words" trigger are the current
  mitigations; a smaller model or a pre-computed prototype table are
  the obvious next levers if it matters in practice.
- The feature has no server-side component, so it can't be improved
  from search logs without first deciding to collect them — a deliberate
  privacy default, and the reason the parser's test corpus is the place
  new phrasings get added.

## Alternatives rejected

- **Hosted LLM (OpenAI/Anthropic) with a JSON schema.** Best raw
  coverage; ruled out by the no-billing constraint, and it would make
  every search a third-party data flow.
- **A free hosted model behind a Vercel function.** Any model good
  enough to structure free text reliably is too large for a free
  serverless tier's cold start and memory, and "free" hosted inference
  APIs are rate-limited previews, not something to build a search box
  on. It would also move the query off-device for no gain over the
  in-browser model.
- **`@huggingface/transformers` as an npm dependency.** Heavier install,
  a native post-install pnpm would block in CI, and bundler config to
  exclude the Node backend — all to ship the same browser code the CDN
  already serves.
- **Zero-shot NLI classification instead of embeddings.** A capable NLI
  model is 3× the download of MiniLM for a task that, against a closed
  vocabulary, prototype similarity handles at least as well.
- **The embedding model as the primary parser (no rules).** Numbers,
  ranges, dates and postcodes are exactly what small embedding models are
  worst at; rules are exact, instant and testable there.
