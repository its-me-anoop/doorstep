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

This repository is at an early milestone (**M0 — Foundation**, see
[Delivery status](#delivery-status) below): the account/auth shell exists,
but search, listings, images and email are not built yet. Don't go looking
for them.

## Stack

| Layer | Choice |
| --- | --- |
| Web app | Next.js 16 (App Router) + TypeScript + React 19 |
| Styling / UI | Tailwind CSS v4 + shadcn/ui + React Hook Form |
| Hosting | Vercel, functions pinned to `lhr1` (London) |
| Auth | Firebase Auth (email, Google, Apple) + Admin SDK session cookies |
| Database | Neon Postgres + PostGIS (source of truth) |
| ORM / migrations | Drizzle ORM + drizzle-kit |
| Search | Meilisearch Cloud, EU region (scaffolded from M0, wired from M2) |
| File storage | Firebase Storage, behind an `ImageStorage` port (wired from M1) |
| Maps + geocoding | Mapbox GL JS + Geocoding, postcodes.io for UK postcodes (from M2/M3) |
| Email | Resend + React Email (wired from M4, or earlier for auth emails) |
| Rate limiting | Upstash Redis (wired from M4) |
| Testing | Vitest 4 (node + jsdom projects) + Playwright + axe |

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
                            meilisearch/, resend/, mapbox/, upstash/)
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
Mapbox, Meilisearch, Resend and Upstash have no env vars yet because
nothing calls them until M1–M4 (see [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md#8-what-m0-deliberately-stubs)).

| Variable | Required | Where it comes from | Notes |
| --- | --- | --- | --- |
| `DATABASE_URL` | Yes | Neon project connection string (or a local Postgres+PostGIS instance) | Read by `drizzle.config.ts` and `src/adapters/drizzle/client.ts`. Must have the `postgis` and `citext` extensions available — `pnpm db:migrate` creates them (migration `0000_enable_extensions.sql`) |
| `TEST_DATABASE_URL` | No | Same as above, a disposable test database | Only set in CI or if you have a local Postgres+PostGIS instance. `tests/integration/*.test.ts` skip cleanly when unset |
| `NEXT_PUBLIC_FIREBASE_API_KEY` | Yes | Firebase console → Project settings → General → Your apps → Web app | Not secret — shipped to the browser |
| `NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN` | Yes | Same place | Not secret |
| `NEXT_PUBLIC_FIREBASE_PROJECT_ID` | Yes | Same place | Not secret |
| `NEXT_PUBLIC_FIREBASE_APP_ID` | Yes | Same place | Not secret |
| `FIREBASE_PROJECT_ID` | Yes | Firebase console → Project settings → Service accounts → Generate new private key | Server only — part of the Admin SDK service account JSON |
| `FIREBASE_CLIENT_EMAIL` | Yes | Same service account JSON | Server only, secret |
| `FIREBASE_PRIVATE_KEY` | Yes | Same service account JSON | Server only, secret. Keep the literal `\n` escapes from the JSON — most hosting env-var UIs (including Vercel's) don't preserve real newlines. `src/adapters/firebase/admin-app.ts` unescapes it back into a real PEM |
| `SESSION_COOKIE_NAME` | No | You choose | Defaults to `__session` (`src/lib/session-cookie-name.ts`) |

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

### Meilisearch Cloud (EU) — scaffold only in M0

Search isn't built until M2 — nothing in the app calls Meilisearch yet.
Create a Meilisearch Cloud project in an **EU region** ahead of that
milestone so the master key exists and can be added to Vercel's env vars
when the `SearchIndex` adapter lands; there's no need to do this to get M0
working.

### Which of these does M0 actually need?

PRD §13's M0 exit criterion is: *"Sign up, sign in, sign out on prod URL;
CI blocks on typecheck, lint, unit, e2e smoke; schema deployed with PostGIS
enabled."* That requires a real **prod Firebase project** (auth round-trip
has to work for real), a real **prod Neon database** with migrations
applied (PostGIS enabled), and a real **prod Vercel deployment**. It does
**not** require Meilisearch — that account can wait until M2.

## Scripts

Run from the repo root (each proxies to `apps/web` via pnpm workspaces):

| Script | What it does |
| --- | --- |
| `pnpm dev` | Starts the Next.js dev server |
| `pnpm build` | Production build |
| `pnpm lint` | ESLint (includes the layer-boundary rules) |
| `pnpm typecheck` | `tsc --noEmit` |
| `pnpm test` | All Vitest tests (`tests/unit` + `tests/integration`; integration tests skip without `TEST_DATABASE_URL`) |
| `pnpm test:unit` | Vitest, `tests/unit` only |
| `pnpm test:integration` | Vitest, `tests/integration` only |
| `pnpm test:e2e` | Playwright (`tests/e2e`) |
| `pnpm db:generate` | `drizzle-kit generate` — writes a new migration from schema changes |
| `pnpm db:migrate` | `drizzle-kit migrate` — applies pending migrations |
| `pnpm seed` | Runs `apps/web/scripts/seed.ts` — idempotent, inserts ~20 fixture listings |

Two scripts aren't proxied at the root and need `pnpm --filter web run <name>`:

| Script | What it does |
| --- | --- |
| `start` | `next start` — serves the production build (run `pnpm build` first) |
| `seed:assert` | Asserts the seed produced exactly 20 properties (used by CI after seeding twice, to prove idempotency) |

## Testing

Vitest 4 runs two projects from one config
([`apps/web/vitest.config.mts`](apps/web/vitest.config.mts)): `node` for
domain/services/adapters, `dom` (jsdom) for anything that renders a
component.

- **Unit** — `pnpm test:unit`. No external services. 249+ tests today
  covering domain, services, adapters (with fakes/mocks) and components.
- **Integration** — `pnpm test:integration`. Needs `TEST_DATABASE_URL`
  pointing at a real Postgres+PostGIS instance; skips cleanly when unset —
  there's no Docker and no local database on a typical dev machine, so
  this only runs for real in CI, against a `postgis/postgis:16-3.4`
  service container.
- **e2e** — `pnpm test:e2e` (Playwright + axe). With `BASE_URL` unset, it
  builds and starts the app itself against a placeholder environment (no
  real Firebase/database needed). Set `BASE_URL` to point Playwright at an
  already-running app (a preview deployment, for example) instead of
  spawning its own server.

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
  organised, the dependency rule, auth flow, data layer, what M0 stubs
- [`docs/adr/`](docs/adr/) — architecture decision records
- [`docs/CONTRIBUTING.md`](docs/CONTRIBUTING.md) — workflow, TDD
  expectations, how to add an adapter, definition of done
