# Doorstep

[![CI](https://github.com/its-me-anoop/doorstep/actions/workflows/ci.yml/badge.svg?branch=main)](https://github.com/its-me-anoop/doorstep/actions/workflows/ci.yml)

Doorstep is a UK property marketplace in the spirit of Rightmove, for buying,
selling and renting. Estate agents, letting agents and private owners list
homes; buyers and renters search by place name or postcode, filter, browse
list or map views, save favourites and searches, and enquire directly with
the lister. An internal admin team approves every listing before it goes
live and moderates content.

The MVP launches as a free hyperlocal beta in **Reading and the Thames
Valley** with a handful of partner agencies, before widening coverage. Web
first (Next.js), with a Flutter app as a phase-2 fast follow. Full product
detail lives in [`docs/PRD.md`](docs/PRD.md).

This repository has completed **M1 — Listing CRUD + images** and
**M2 — Search + filters** (see [Delivery status](#delivery-status) below):
account/auth, lister onboarding, the create-listing wizard, the image
pipeline, the my-listings dashboard, the Meilisearch-backed search API,
results UI, area landing pages and the public listing detail page are all
built and tested. The map view, favourites/saved searches, enquiries,
admin and email are not built yet — don't go looking for them.

## Delivery status

Full milestone plan: [`docs/PRD.md` §13](docs/PRD.md#13-milestones-and-delivery-plan).

- **M0 — Foundation.** Done. Repo, CI gates (typecheck, lint, unit,
  integration, build, e2e), Vercel + Neon + Firebase projects (dev/preview/
  prod), Drizzle schema and migrations (PostGIS + citext enabled), auth with
  session cookies and roles, design tokens and app shell, seed script.
- **M1 — Listing CRUD + images.** Done. An agent or a private owner can
  onboard, build a complete listing with photos, and submit it for approval:
  - **Lister onboarding** — "I'm a private owner" (instant `owner` role) or
    "I'm an agent" (creates an unverified agency, grants `agent`). `/lister`
    and `/onboarding` are gated on session presence only in `src/proxy.ts`;
    the real owner/agent/admin role check is DB-backed, enforced in the
    `(lister)` route-group layout against `users.role`, never the session
    cookie's (UX-only) claim.
  - **Create-listing wizard** — six steps (channel & type, address, details,
    description & features, photos, review), shared Zod schemas validated
    client- and server-side, silent debounced autosave with a resumable
    draft.
  - **Image pipeline** — signed direct-to-Firebase-Storage uploads, sharp-
    rendered WebP/AVIF variants at 400/800/1600w, EXIF (including GPS)
    stripped on processing, blurhash placeholders, long-cache immutable
    public URLs via Firebase's download-token scheme; originals stay
    private.
  - **My-listings dashboard** — status filter, one-click status transitions
    (Sold STC / Let Agreed / Sold / Let / Hide / Unhide / Back on market)
    with optimistic UI and a 6-second undo, plus draft deletion.
  - **Postcode fast-path** — the wizard's address step resolves full and
    partial UK postcodes via postcodes.io; free-text place search (Mapbox)
    is still M2.
- **M2 — Search + filters.** Done. Meilisearch is a real, disposable search
  projection kept in sync with Postgres (ADR-0003), and buyers/renters can
  search, filter, sort, share a search by URL, and land on curated area
  pages:
  - **Search index and settings** — `adapters/meilisearch/` implements the
    `SearchIndex` port against PRD §8.6's document shape, plus `slug` and
    `status` (doc-shape v2, `src/ports/search-index.ts`) so a search hit
    can link to its detail page and badge Sold STC/Let Agreed with no
    per-hit Postgres lookup; filterable/sortable/searchable attributes and
    facets (`propertyType`, `furnished`, `tenure`, `bedrooms`) match the
    PRD exactly.
  - **Outbox drain cron** — every visibility-relevant mutation already
    wrote an `outbox` row since M1 (ADR-0005); M2 adds the consumer.
    `DrainOutbox` (`src/services/search-sync/drain-outbox.ts`) claims a
    batch with `SELECT ... FOR UPDATE SKIP LOCKED` plus a 5-minute claim
    lease (`src/adapters/drizzle/repositories/outbox-repository.ts`),
    re-derives each entry from Postgres's _current_ state rather than
    trusting a possibly-stale `op`, and issues one batched
    upsert/delete call to Meilisearch. `GET /api/cron/outbox-drain` runs
    it every minute (`apps/web/vercel.json`'s `* * * * *` cron), gated by
    `CRON_SECRET` (`src/lib/verify-cron-request.ts`) — this is what the
    PRD §6.5 LST-5 "search visibility within 1 minute" target rides on.
  - **Nightly reindex** — `GET /api/cron/reindex` (03:00 daily cron) runs
    `RebuildSearchIndex` (`src/services/search-sync/rebuild-search-index.ts`):
    clear-then-rebuild from Postgres, page by page, comparing Postgres's
    indexable-listing count against Meilisearch's document count
    afterwards and logging a warning on mismatch (PRD §7.7's drift
    signal — see ADR-0008 for why clear-then-rebuild rather than
    diff-and-patch).
  - **Search API and geocode suggestions** — `GET /api/v1/search`
    (`src/lib/validation/search.ts`: channel required, a point+radius or a
    bbox or neither — never both, price/beds/baths/type/tenure/furnished/
    availableBy/newHome/town/outcode filters, sort, pagination) returns
    `503 { error: { code: 'search_unavailable' } }` on a Meilisearch
    outage rather than a 500 (PRD §7.6); `GET /api/v1/geocode?q=` now
    returns postcode-fast-path results and free-text place suggestions in
    one discriminated list (`{ data: { version: 2, results } }`) — the
    place-search half uses Mapbox when `MAPBOX_ACCESS_TOKEN` is set, else
    falls back to postcodes.io's own keyless Places API (OS Open Names
    GB), a documented deviation from the PRD's Mapbox-only framing
    (ADR-0007). Both halves are cached 30 days
    (`InMemoryTtlGeocodeCache` today; Upstash Redis lands M4).
  - **Results UI with URL state** — the filter disclosure popover pattern
    (M2-DESIGN-SPEC.md §1.6), individually removable filter chips, stepped
    price selects with sale/rent-specific values, blurhash-first loading
    on result cards, and `src/lib/search-url.ts` as the single source of
    truth for what the current search _is_ — every criterion round-trips
    through a shareable URL, and a Meilisearch outage renders
    `OutagePanel` in the results slot only, with the header, filter bar
    and chips still fully interactive.
  - **Area pages and public detail** — `/for-sale/{area}` and
    `/to-rent/{area}` (`src/lib/areas.ts`'s curated list) are fully
    dynamic (SSR per request), not ISR, because they read `searchParams`
    to support filtered visits (`/for-sale/reading?minBeds=2`), which
    disqualifies the whole route from static generation under Next's
    classic App Router model — see `docs/ARCHITECTURE.md` §16 for the
    full explanation and the tracked follow-up. The public listing detail
    page (`GET /api/v1/properties/{slug}`, `/property/{slug}`,
    published/under_offer only) reads no `searchParams`, so it *is*
    genuinely ISR, with on-demand revalidation on publish/edit/status
    change (`src/lib/listing-revalidation.ts`).
  - **5k-listing bench tooling** — `pnpm seed:search-5k` (and
    `:clean`) plus `pnpm bench:search`, built for PRD §13's M2 exit
    criterion ("seeded 5k listings; p75 search under 500 ms") — see
    [Search](#search) below for how to run them.
- **M3 (map view) through M6 (hardening + launch)** — not started.

## Stack

| Layer            | Choice                                                                                                                                                                                                                                          |
| ---------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Web app          | Next.js 16 (App Router) + TypeScript + React 19                                                                                                                                                                                                 |
| Styling / UI     | Tailwind CSS v4 + shadcn/ui + React Hook Form                                                                                                                                                                                                   |
| Hosting          | Vercel, functions pinned to `lhr1` (London)                                                                                                                                                                                                     |
| Auth             | Firebase Auth (email, Google, Apple) + Admin SDK session cookies                                                                                                                                                                                |
| Database         | Neon Postgres + PostGIS (source of truth)                                                                                                                                                                                                       |
| ORM / migrations | Drizzle ORM + drizzle-kit                                                                                                                                                                                                                       |
| Search           | Meilisearch Cloud, EU region — wired M2: index + settings, transactional-outbox sync, nightly reindex, public search API (see [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md) and ADR-0003/0005/0008)                                            |
| File storage     | Firebase Storage, behind an `ImageStorage` port (wired M1: signed uploads, sharp variants, EXIF strip, blurhash, download-token URLs)                                                                                                           |
| Maps + geocoding | postcodes.io UK postcode fast-path (wired M1) and free-text place search (wired M2, `GET /api/v1/geocode?q=`) — Mapbox when `MAPBOX_ACCESS_TOKEN` is set, else postcodes.io's own Places API (ADR-0007); Mapbox GL JS for the map view lands M3 |
| Email            | Resend + React Email (wired from M4, or earlier for auth emails)                                                                                                                                                                                |
| Rate limiting    | Upstash Redis (wired from M4)                                                                                                                                                                                                                   |
| Testing          | Vitest 4 (node + integration + jsdom projects) + Playwright + axe                                                                                                                                                                               |

Full rationale for each choice: [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md)
and the ADRs in [`docs/adr/`](docs/adr/).

## Repo layout

```
doorstep/
  apps/
    web/                   The one deployable app in M0
      src/
        app/               Next.js routes only (RSC pages, /api/v1 handlers)
        proxy.ts           Route gating for /account, /lister, /admin
                            (Next.js 16 renamed middleware.ts -> proxy.ts)
        domain/            Entities, value objects, listing state machine, policies
        services/          Use cases, orchestrating ports
        ports/             Interfaces domain/services depend on
        adapters/          Concrete implementations of ports (drizzle/, firebase/,
                            postcodesio/, meilisearch/, resend/, mapbox/, upstash/)
        components/        UI primitives + feature components
        lib/               Composition root, route-gating logic, shared Zod schemas
      tests/
        unit/              Domain + services + adapters, in-memory fakes
        integration/       Adapters against a real Postgres/PostGIS container
        e2e/                Playwright, critical journeys
      scripts/             seed.ts, seed-data.ts, assert-seed-count.ts
      drizzle.config.ts    Points at src/adapters/drizzle/
  packages/                No packages yet — the workspace glob reserves this
                            for a future shared types package (phase 2 Flutter)
  docs/
    PRD.md                 Product requirements — source of truth
    ARCHITECTURE.md         How the code is organised and why
    adr/                    Architecture decision records
    CONTRIBUTING.md         How to work in this repo
  .github/workflows/ci.yml  typecheck, lint, unit, integration, build, e2e
```

See [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md) for the dependency rule
between these layers and how it's enforced.

## Prerequisites

- Node.js 24+ (pinned in [`.nvmrc`](.nvmrc); `nvm use` picks it up)
- pnpm 11 (pinned via `packageManager` in [`package.json`](package.json) —
  `corepack enable` will use the right version automatically)
- No Docker and no local database required to develop — see
  [Testing](#testing) for what that means for integration tests

## Quickstart

```bash
git clone git@github.com:its-me-anoop/doorstep.git
cd doorstep
pnpm install

cp .env.example .env.local
# Fill in .env.local — see the Environment variables table below, and
# Setup (manual accounts) if you don't have Firebase/Neon projects yet.

pnpm db:migrate   # applies migrations, including PostGIS + citext (0000)
pnpm seed         # inserts ~20 realistic Reading/Thames Valley listings
pnpm dev          # http://localhost:3000
```

If you don't yet have a Firebase project or a Postgres database, see
[Setup: services to create manually](#setup-services-to-create-manually)
first — `pnpm dev` will start without them, but sign-up/sign-in and
`pnpm db:migrate`/`pnpm seed` need real credentials.

## Environment variables

Copy [`.env.example`](.env.example) to `.env.local` and fill it in. Every
variable the app reads today is listed below; nothing here is invented —
Meilisearch and Mapbox are wired as of M2 (below); Resend and Upstash
still have no env vars because nothing calls them until M4 (see
[`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md#8-what-m0-deliberately-stubs)).

| Variable                                             | Required                  | Where it comes from                                                               | Notes                                                                                                                                                                                                                                                                                                                                                                                             |
| ---------------------------------------------------- | ------------------------- | --------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `DATABASE_URL`                                       | Yes                       | Neon project connection string (or a local Postgres+PostGIS instance)             | Read by `drizzle.config.ts` and `src/adapters/drizzle/client.ts`. Must have the `postgis` and `citext` extensions available — `pnpm db:migrate` creates them (migration `0000_enable_extensions.sql`)                                                                                                                                                                                             |
| `TEST_DATABASE_URL`                                  | No                        | Same as above, a disposable test database                                         | Only set in CI or if you have a local Postgres+PostGIS instance. `tests/integration/*.test.ts` skip cleanly when unset                                                                                                                                                                                                                                                                            |
| `NEXT_PUBLIC_FIREBASE_API_KEY`                       | Yes                       | Firebase console → Project settings → General → Your apps → Web app               | Not secret — shipped to the browser                                                                                                                                                                                                                                                                                                                                                               |
| `NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN`                   | Yes                       | Same place                                                                        | Not secret                                                                                                                                                                                                                                                                                                                                                                                        |
| `NEXT_PUBLIC_FIREBASE_PROJECT_ID`                    | Yes                       | Same place                                                                        | Not secret                                                                                                                                                                                                                                                                                                                                                                                        |
| `NEXT_PUBLIC_FIREBASE_APP_ID`                        | Yes                       | Same place                                                                        | Not secret                                                                                                                                                                                                                                                                                                                                                                                        |
| `FIREBASE_PROJECT_ID`                                | Yes                       | Firebase console → Project settings → Service accounts → Generate new private key | Server only — part of the Admin SDK service account JSON                                                                                                                                                                                                                                                                                                                                          |
| `FIREBASE_CLIENT_EMAIL`                              | Yes                       | Same service account JSON                                                         | Server only, secret                                                                                                                                                                                                                                                                                                                                                                               |
| `FIREBASE_PRIVATE_KEY`                               | Yes                       | Same service account JSON                                                         | Server only, secret. Keep the literal `\n` escapes from the JSON — most hosting env-var UIs (including Vercel's) don't preserve real newlines. `src/adapters/firebase/admin-app.ts` unescapes it back into a real PEM                                                                                                                                                                             |
| `FIREBASE_STORAGE_BUCKET`                            | Yes (for image features)  | Firebase console → Storage → bucket name, e.g. `my-project.firebasestorage.app`   | Not secret — the bucket name, not a credential (`src/adapters/firebase/firebase-storage-adapter.ts`, PRD §8.7). Required for the image pipeline (`POST /api/v1/listings/{id}/images` and friends); `createServices()` throws a clear error naming this var if it's unset                                                                                                                          |
| `TEST_FIREBASE_STORAGE_BUCKET`                       | No                        | Same as above, a bucket you're okay writing disposable test objects to            | Set only to run `tests/integration/image-storage-firebase.contract.test.ts` against a real bucket (PRD §8.7's storage-adapter contract-test exit criterion) — unset in CI, where it skips cleanly; the in-memory fake's contract run (`image-storage-inmemory.contract.test.ts`) still enforces the contract there                                                                                |
| `FIREBASE_STORAGE_EMULATOR_HOST`                     | No                        | You choose, e.g. `127.0.0.1:9199`                                                 | Points the real `FirebaseStorageAdapter` at a local `firebase emulators:start --only storage` instead of a live bucket — see [Firebase Storage emulator (no live bucket needed)](#firebase-storage-emulator-no-live-bucket-needed) below. Leave unset to use a real bucket                                                                                                                        |
| `SESSION_COOKIE_NAME`                                | No                        | You choose                                                                        | Defaults to `__session` (`src/lib/session-cookie-name.ts`)                                                                                                                                                                                                                                                                                                                                        |
| `MEILISEARCH_HOST`                                   | Yes (for search)          | Meilisearch Cloud project URL, or `http://127.0.0.1:7700` for a local daemon      | Required to construct `MeilisearchSearchIndex` (`src/adapters/meilisearch/`, PRD §8.6)                                                                                                                                                                                                                                                                                                            |
| `MEILISEARCH_API_KEY`                                | No                        | Meilisearch Cloud project's master/API key                                        | Omit for a local daemon running with no `--master-key`                                                                                                                                                                                                                                                                                                                                            |
| `MEILISEARCH_INDEX_PREFIX`                           | No                        | You choose                                                                        | Namespaces the index this adapter reads/writes (`{prefix}-listings`) — defaults to `doorstep`. Only needs setting to run more than one environment (dev, CI, a preview deploy) against the same Meilisearch instance without their documents colliding                                                                                                                                            |
| `TEST_MEILISEARCH_HOST` / `TEST_MEILISEARCH_API_KEY` | No                        | Same as above, a daemon you're okay creating disposable indexes on                | Set only to run `tests/integration/meilisearch-adapter.test.ts` against a real daemon — every other suite skips cleanly without them. Each run creates its own disposable, randomly named index and deletes it again in `afterAll`                                                                                                                                                                |
| `MAPBOX_ACCESS_TOKEN`                                | No                        | [account.mapbox.com](https://account.mapbox.com/) → a public token (`pk.*`)       | Optional: when set, `lib/composition.ts` wires `MapboxGeocoder` as the free-text place-search provider (GB-biased); when unset, `adapters/postcodesio/`'s own free, keyless Places API (OS Open Names GB) is used instead — see ADR-0007 for why this is a documented deviation from the PRD's Mapbox-only framing, not an oversight. Not provisioned in this project's local/CI environments yet |
| `CRON_SECRET`                                        | Yes (for the cron routes) | You choose, e.g. `openssl rand -hex 32`                                           | Authorises `app/api/cron/outbox-drain` and `app/api/cron/reindex` (`src/lib/verify-cron-request.ts`, PRD §8.6). Vercel attaches `Authorization: Bearer ${CRON_SECRET}` automatically to its own scheduled requests once this is set on the project; both routes reject every request with a 401 while it's unset                                                                                  |

Never commit real values for any of the secret-marked variables above — only
placeholders belong in `.env.example`, and `.env*.local` is gitignored.

## Setup: services to create manually

These are cloud accounts and projects you (Anoop) need to create by hand —
nothing in this repo can provision them. Three environments throughout:
**dev**, **preview**, **prod** — separate projects/databases for each, no
shared credentials (PRD §7.4).

### Firebase (dev / preview / prod)

1. Create three Firebase projects (e.g. `doorstep-dev`, `doorstep-preview`,
   `doorstep-prod`). Firebase Authentication itself has no region setting;
   set the region to **`europe-west2`** for project resources that do ask
   for one (Storage bucket, Firestore, if used) to keep data in the UK.
2. In each project, go to **Authentication → Sign-in method** and enable:
   **Email/Password**, **Google**, and **Apple**.
3. In each project, go to **Project settings → General → Your apps**, add
   a Web app, and copy the config into `NEXT_PUBLIC_FIREBASE_*`.
4. In each project, go to **Project settings → Service accounts → Generate
   new private key**. This downloads a JSON file — copy `project_id` →
   `FIREBASE_PROJECT_ID`, `client_email` → `FIREBASE_CLIENT_EMAIL`, and
   `private_key` → `FIREBASE_PRIVATE_KEY` (keep the `\n` escapes as-is).
   Delete the downloaded JSON once copied; never commit it.

### Firebase Storage emulator (no live bucket needed)

The image pipeline (signed upload → sharp variants → public URL) needs a
Storage bucket, but creating one needs Firebase's Blaze (pay-as-you-go)
billing plan enabled on the project — not always available right away (a
closed billing account blocked bucket creation on this repo's own dev
project for a while). The [Firebase Storage
emulator](https://firebase.google.com/docs/emulator-suite) lets the whole
pipeline run locally against `FirebaseStorageAdapter` — the real adapter,
not a fake — with no live bucket at all:

```bash
pnpm emulator:storage   # firebase emulators:start --only storage, port 9199
```

Then, in another terminal, add to `.env.local`:

```bash
FIREBASE_STORAGE_EMULATOR_HOST=127.0.0.1:9199
```

and start the app as usual (`pnpm dev`, or `pnpm build && pnpm --filter web start`
for a production-mode run). `FIREBASE_STORAGE_BUCKET` can stay whatever it
already is — under emulation the bucket name is just a path prefix, not a
real bucket that has to exist. `firebase.json`/`storage.rules` at the repo
root configure the emulator (port 9199, rules loaded but never deployed —
see `storage.rules`'s own header comment for why they're intentionally
wide open). `tests/integration/image-storage-firebase-emulator.contract.test.ts`
runs the full `ImageStorage` contract suite against the emulator whenever
`FIREBASE_STORAGE_EMULATOR_HOST` is set (see
[Testing](#testing) below) — CI runs this on every push, so the storage
adapter contract stays enforced against a real Storage API surface even
without a live project.

Once the dev project has a live bucket, switch back to the [Firebase
console steps above](#firebase-dev--preview--prod) — unset
`FIREBASE_STORAGE_EMULATOR_HOST` and the adapter's production code paths
(byte-identical either way) start hitting the real bucket again.

### Neon (dev / preview / prod)

1. Create a Neon project in **`aws-eu-west-2`** (AWS London).
2. There is no PostGIS toggle in the console — it's enabled by running the
   migrations: point `DATABASE_URL` at the new database and run
   `pnpm db:migrate`. Migration `0000_enable_extensions.sql` runs
   `CREATE EXTENSION IF NOT EXISTS postgis` and `citext`.
3. For preview environments, enable Neon's branching (via the Neon
   Vercel integration, or the Neon API from CI) so every Vercel preview
   deployment gets its own fresh branch database with schema + seed
   applied — this is what keeps PR previews isolated from each other and
   from prod.

### Vercel

1. Create a Vercel project linked to the `its-me-anoop/doorstep` GitHub
   repository, with the root directory set to `apps/web`.
2. Set the function region to **`lhr1`** (Project Settings → Functions →
   Function Region).
3. Add every variable from the [environment variables table](#environment-variables)
   under Project Settings → Environment Variables, scoped per environment
   (Development / Preview / Production) using the matching Firebase
   project and Neon database for each.
4. Enable the GitHub integration so pull requests get automatic preview
   deployments.

### Meilisearch Cloud (EU) — needed from M2

1. Create a Meilisearch Cloud project in an **EU region** (data residency,
   PRD §7.5) — one per environment (dev/preview/prod), same reasoning as
   the Firebase/Neon projects above: previews and prod must never share
   index documents.
2. Copy the project's host URL and API key into `MEILISEARCH_HOST` /
   `MEILISEARCH_API_KEY` (see the [environment variables
   table](#environment-variables)) — in Vercel, scoped per environment
   under Project Settings → Environment Variables, same as every other
   var.
3. See [Search](#search) below for what still needs doing once the
   project exists: applying settings, populating the index, and wiring
   `CRON_SECRET` so the two cron routes (outbox drain, nightly reindex)
   are authorised to run. A local dev/CI Meilisearch instance needs none
   of this cloud setup — see [Search](#search)'s local-stack steps.

Mapbox (`MAPBOX_ACCESS_TOKEN`) is optional at any environment — see the
[environment variables table](#environment-variables) and ADR-0007 for
why an unset token is a supported permanent choice, not a placeholder to
fill in later.

### Which of these does M0 actually need?

PRD §13's M0 exit criterion is: _"Sign up, sign in, sign out on prod URL;
CI blocks on typecheck, lint, unit, e2e smoke; schema deployed with PostGIS
enabled."_ That requires a real **prod Firebase project** (auth round-trip
has to work for real), a real **prod Neon database** with migrations
applied (PostGIS enabled), and a real **prod Vercel deployment**. It does
**not** require Meilisearch — that account can wait until M2.

## Scripts

Run from the repo root (each proxies to `apps/web` via pnpm workspaces):

| Script                      | What it does                                                                                                                                                                |
| --------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `pnpm dev`                  | Starts the Next.js dev server                                                                                                                                               |
| `pnpm build`                | Production build                                                                                                                                                            |
| `pnpm lint`                 | ESLint (includes the layer-boundary rules)                                                                                                                                  |
| `pnpm typecheck`            | `tsc --noEmit`                                                                                                                                                              |
| `pnpm test`                 | All Vitest tests (`tests/unit` + `tests/integration`; integration tests skip without `TEST_DATABASE_URL`)                                                                   |
| `pnpm test:unit`            | Vitest, `tests/unit` only                                                                                                                                                   |
| `pnpm test:integration`     | Vitest, `tests/integration` only                                                                                                                                            |
| `pnpm test:e2e`             | Playwright (`tests/e2e`)                                                                                                                                                    |
| `pnpm db:generate`          | `drizzle-kit generate` — writes a new migration from schema changes                                                                                                         |
| `pnpm db:migrate`           | `drizzle-kit migrate` — applies pending migrations                                                                                                                          |
| `pnpm seed`                 | Runs `apps/web/scripts/seed.ts` — idempotent, inserts ~20 fixture listings                                                                                                  |
| `pnpm seed:search-5k`       | Inserts and indexes 5,000 synthetic listings (`apps/web/scripts/seed-search-5k.ts`) — PRD §13's M2 bench-evidence exit criterion. See [Search](#search) below               |
| `pnpm seed:search-5k:clean` | Removes the bench-generated rows from both Postgres and Meilisearch, leaving the ~20 fixture listings untouched                                                             |
| `pnpm bench:search`         | Fires 300 mixed `GET /api/v1/search` requests against a running server and prints p50/p75/p95/p99 latency (`apps/web/scripts/search-bench.ts`). See [Search](#search) below |
| `pnpm emulator:storage`     | Starts the Firebase Storage emulator on port 9199 — see [Firebase Storage emulator](#firebase-storage-emulator-no-live-bucket-needed)                                       |

A few scripts aren't proxied at the root and need `pnpm --filter web run <name>`:

| Script                      | What it does                                                                                                                                                                                                                                                                                                                                                     |
| --------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `start`                     | `next start` — serves the production build (run `pnpm build` first)                                                                                                                                                                                                                                                                                              |
| `seed:assert`               | Asserts the seed produced exactly 20 properties (used by CI after seeding twice, to prove idempotency)                                                                                                                                                                                                                                                           |
| `reindex:local`             | Runs `RebuildSearchIndex` locally against `DATABASE_URL`/`MEILISEARCH_HOST` — the same use case `GET /api/cron/reindex` calls, without needing a signed cron request. See [Search](#search) below for the Storage-emulator dependency this has when the ~20 fixture listings have images                                                                         |
| `backfill:storage-emulator` | Uploads a tiny real image to every variant path the ~20 fixture listings' `property_images` rows expect, against the Firebase Storage emulator — closes the gap `seed.ts` leaves (it inserts `property_images` rows directly, never runs a real upload), so `reindex:local` and the public detail page can resolve real image URLs locally without a live bucket |

## Search

M2 wires Meilisearch as PRD §8.6's disposable search projection, synced
from Postgres via the transactional outbox (ADR-0005) and reconciled by a
nightly full reindex (ADR-0008). Full design: [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md)'s
M2 sections; the free-text place-search provider choice:
[ADR-0007](docs/adr/0007-postcodesio-places-fallback-for-geocoding.md).

### Running the full local stack

1. **Postgres** (PostGIS enabled, migrated and seeded — see
   [Quickstart](#quickstart) above) needs to already be running.
2. **Meilisearch** — a local daemon, no Docker required:

   ```bash
   nohup /opt/homebrew/bin/meilisearch \
     --db-path ~/.local/share/doorstep-meili/data \
     --master-key local-dev-master-key \
     --http-addr 127.0.0.1:7700 \
     --no-analytics \
     > ~/.local/share/doorstep-meili/meili.log 2>&1 &
   ```

   Then in `.env.local`:

   ```bash
   MEILISEARCH_HOST=http://127.0.0.1:7700
   MEILISEARCH_API_KEY=local-dev-master-key
   ```

3. **Index something.** `pnpm seed` alone does not populate Meilisearch —
   M1's seed script predates the search projection, and nothing indexes
   automatically until the outbox drain cron runs against a deployed
   environment. Two local options:
   - `pnpm seed:search-5k` — inserts and indexes 5,000 synthetic,
     image-less listings directly (bypassing `ImageStorage` entirely), the
     fastest way to get real, non-trivial search results locally. `pnpm
seed:search-5k:clean` removes them again without touching the ~20
     fixture listings.
   - `pnpm --filter web reindex:local` — indexes the ~20 realistic fixture
     listings instead, by running the same `RebuildSearchIndex` use case
     `GET /api/cron/reindex` calls. This one has a real dependency worth
     knowing about: several fixture listings have photos, and indexing
     resolves each cover photo's public URL through
     `ImageStorage.publicUrl()` — a real network call that 404s (aborting
     the whole reindex) unless something actually exists at that path.
     Run the [Firebase Storage emulator](#firebase-storage-emulator-no-live-bucket-needed)
     and backfill it first:
     ```bash
     pnpm emulator:storage &
     FIREBASE_STORAGE_EMULATOR_HOST=127.0.0.1:9199 pnpm --filter web backfill:storage-emulator
     FIREBASE_STORAGE_EMULATOR_HOST=127.0.0.1:9199 pnpm --filter web reindex:local
     ```
4. `pnpm dev` — `GET /api/v1/search`, `/for-sale`, `/to-rent` and their
   area pages now return real, indexed results.

### 5k-listing bench (PRD §13's M2 exit criterion)

```bash
pnpm seed:search-5k        # insert + index 5,000 synthetic listings
pnpm build && pnpm --filter web start -- -p 3005   # 3000/3001/3007 are reserved
BASE_URL=http://127.0.0.1:3005 pnpm bench:search   # p50/p75/p95/p99 + error count
pnpm seed:search-5k:clean  # remove the bench rows from Postgres and Meilisearch
```

`bench:search` checks `SearchIndex.healthy()` first and fails fast with a
clear message if Meilisearch isn't reachable, rather than firing 300
requests that would all just 503.

### What prod needs (Anoop-side, not automatable from this repo)

1. Create a Meilisearch Cloud project per environment in an **EU region**
   (see [Setup](#meilisearch-cloud-eu--needed-from-m2) above).
2. Add `MEILISEARCH_HOST`, `MEILISEARCH_API_KEY` and (if running more than
   one environment against one instance) `MEILISEARCH_INDEX_PREFIX` to
   Vercel's env vars, scoped per environment (Development/Preview/
   Production) — previews and prod must use different prefixes/projects
   so their index documents never collide.
3. Generate and set `CRON_SECRET` (`openssl rand -hex 32`) in Vercel's env
   vars — this is what authorises `apps/web/vercel.json`'s two cron
   routes (`/api/cron/outbox-drain` every minute, `/api/cron/reindex`
   nightly at 03:00 UTC); Vercel attaches
   `Authorization: Bearer ${CRON_SECRET}` to its own scheduled requests
   automatically once the var is set, and both routes reject every other
   request with a 401 while it's unset.
4. After the first deploy, trigger `/api/cron/reindex` once by hand
   (`curl -H "Authorization: Bearer $CRON_SECRET" https://<prod-url>/api/cron/reindex`)
   so the index has settings and documents applied before the
   once-a-minute outbox drain has anything incremental to apply on top.
5. `MAPBOX_ACCESS_TOKEN` is optional — see the [environment variables
   table](#environment-variables) and ADR-0007. Leaving it unset is a
   supported permanent choice (postcodes.io's Places API serves free-text
   search instead), not a placeholder that has to be filled in before
   launch.

## Testing

Vitest 4 runs three projects from one config
([`apps/web/vitest.config.mts`](apps/web/vitest.config.mts)): `node` for
domain/services/adapters (`tests/unit`, excluding components), `integration`
for `tests/integration`, and `dom` (jsdom) for anything under
`tests/unit/components` that renders a component.

- **Unit** — `pnpm test:unit`. No external services. 1,559+ tests today
  covering domain, services, adapters (with fakes/mocks) and components.
- **Integration** — `pnpm test:integration`. The Drizzle-backed suites need
  `TEST_DATABASE_URL` pointing at a real Postgres+PostGIS instance and skip
  cleanly when unset — there's no Docker and no local database on a typical
  dev machine, so those only run for real in CI, against a
  `postgis/postgis:16-3.4` service container. The `ImageStorage` contract
  suite (PRD §8.7) is split across three files instead: `image-storage-
inmemory.contract.test.ts` runs everywhere (a fake, no live service
  needed); `image-storage-firebase.contract.test.ts` runs the real adapter
  against a **live bucket** only when `TEST_FIREBASE_STORAGE_BUCKET` is
  set — CI has no such secret, so that one only ever runs locally,
  deliberately; and `image-storage-firebase-emulator.contract.test.ts`
  runs the same real adapter against the **[Storage
  emulator](#firebase-storage-emulator-no-live-bucket-needed)** whenever
  `FIREBASE_STORAGE_EMULATOR_HOST` is set — CI runs this one on every
  push (`pnpm emulator:storage`'s config, wrapped by `firebase-tools
emulators:exec` in the `integration` job), so the storage adapter
  contract is enforced against a real Storage API surface continuously,
  not just locally when someone happens to have a live bucket configured.
  `tests/integration/meilisearch-adapter.test.ts` (PRD §8.6, M2) similarly
  needs `TEST_MEILISEARCH_HOST` / `TEST_MEILISEARCH_API_KEY` pointing at a
  real daemon and skips cleanly without them; CI runs it against a
  `getmeili/meilisearch` service container on every push, same shape as
  the Postgres/Storage suites above. `tests/integration/
mapbox-geocoder.test.ts` needs a real `MAPBOX_ACCESS_TOKEN` (unset in
  CI, so it never runs there — the mocked-fetch unit suite in
  `tests/unit/adapters/mapbox/` always does) and
  `tests/integration/postcodesio-geocoder.test.ts` needs live network
  access to postcodes.io.
- **e2e** — `pnpm test:e2e` (Playwright + axe). With `BASE_URL` unset, it
  builds and starts the app itself against a placeholder environment (no
  real Firebase/database needed). Set `BASE_URL` to point Playwright at an
  already-running app (a preview deployment, for example) instead of
  spawning its own server. `tests/e2e/m1.full-journey.spec.ts` is a further-
  gated exception: set `E2E_TEST_EMAIL` / `E2E_TEST_PASSWORD` to an active
  account on the target Firebase project, and `BASE_URL` to an environment
  wired to real Postgres and Storage, to run the full owner journey (sign
  in, onboard, wizard, a real photo upload, submit) end to end. Skipped
  everywhere else, including CI.

**Unit, integration and e2e all run to completion in CI** on every push and
pull request to `main` — see [`.github/workflows/ci.yml`](.github/workflows/ci.yml),
jobs `typecheck`, `lint`, `unit`, `integration`, `build`, `e2e`. The
`integration` job also applies migrations and runs `pnpm seed` twice against
the service container, then `seed:assert`, to prove the seed script is
idempotent. All six jobs must pass before a PR can merge.

## Documentation

- [`docs/PRD.md`](docs/PRD.md) — product requirements (source of truth for
  scope, milestones, and non-functional requirements)
- [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md) — how the code is
  organised, the dependency rule, auth flow, data layer, the M1 onboarding/
  listing/image build, and what's still stubbed
- [`docs/adr/`](docs/adr/) — architecture decision records
- [`docs/CONTRIBUTING.md`](docs/CONTRIBUTING.md) — workflow, TDD
  expectations, how to add an adapter, definition of done
