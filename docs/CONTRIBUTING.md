# Contributing to Doorstep

Solo-dev repo today (see the note at the top of
[`.github/workflows/ci.yml`](../.github/workflows/ci.yml) — no mandatory PR
review is configured; the six CI status checks are the actual safety net).
This document exists so the rules are written down once, rather than
re-explained per PR — and so a second contributor can ramp up without
asking.

## Workflow

Trunk-based, short-lived branches (PRD §8.8):

1. Branch off `main`.
2. Commit as you go, in [Conventional Commits](https://www.conventionalcommits.org/)
   format (`feat:`, `fix:`, `docs:`, `refactor:`, `test:`, `chore:`, `ci:`).
   Intermediate commit hygiene on your branch doesn't matter much, because —
3. Open a PR against `main`. CI runs all six jobs (`typecheck`, `lint`,
   `unit`, `integration`, `build`, `e2e`) — see
   [`.github/workflows/ci.yml`](../.github/workflows/ci.yml). All six must
   be green before merge.
4. **Squash merge.** The squashed commit message is the PR's real history —
   write it as a single Conventional Commit (`type: summary`), not "Merge
   pull request #12". This is what PRD §8.8 means by "conventional commits,
   squash merges."
5. Every PR gets its own Vercel preview deployment wired to a fresh Neon
   branch database (schema + seed applied) — see
   [`docs/ARCHITECTURE.md`](ARCHITECTURE.md#6-environments) — so manual QA
   against a preview URL never shares state with `main` or another open PR.

Keep branches short-lived. A PR that's been open for weeks accumulates
merge-conflict risk and stale preview-database state.

## TDD and the test pyramid

PRD §8.8: **write the failing test first.** Acceptance criteria in
[`docs/PRD.md`](PRD.md) §6 are written to convert directly into tests.

- **Unit** (`apps/web/tests/unit/`) — the bulk of the suite. `domain/` and
  `services/` are developed red-green-refactor against **in-memory fakes**
  for every port, never a real database or Firebase project. Adapters that
  have pure logic (e.g. `src/adapters/drizzle/custom-types.ts`) get unit
  tests too. Run with `pnpm test:unit` — no external services required.
  Vitest 4 splits this into a `node` project (domain/services/adapters) and
  a `dom` (jsdom) project (anything under `tests/unit/components/`) — see
  [`apps/web/vitest.config.mts`](../apps/web/vitest.config.mts).
- **Integration** (`apps/web/tests/integration/`) — adapters against a real
  Postgres+PostGIS container (and, once the search adapter exists,
  Meilisearch). Run with `pnpm test:integration`; needs
  `TEST_DATABASE_URL` — skips cleanly when unset, since there's no
  Docker/local database on a typical dev machine. Exercised for real in
  CI's `integration` job against a `postgis/postgis:16-3.4` service
  container.
- **e2e** (`apps/web/tests/e2e/`) — Playwright, plus `@axe-core/playwright`
  for accessibility, on critical journeys (sign up, sign in, sign out
  today; search-to-enquiry, listing-to-live-in-search, admin moderation,
  etc. as those milestones land — PRD §8.8). Run with `pnpm test:e2e`;
  `BASE_URL` unset spawns the app itself against a placeholder env, set it
  to point at a real deployed URL instead.

When you add a story from the PRD, write its acceptance criteria as a
failing test before writing the implementation. If a service needs a port
that doesn't exist yet, add the port first (interface only), write a fake
implementation for the test, then write the real adapter separately (see
[Adding a new adapter](#adding-a-new-adapter) below).

## The layer dependency rule

**`domain/` and `services/` import only `ports/` and `domain/`. `app/`
reaches business logic through `services/`, resolved from
`lib/composition.ts` — never by importing `adapters/` directly.**

Full rationale: [`docs/ARCHITECTURE.md`](ARCHITECTURE.md#3-the-dependency-rule)
and [ADR-0001](adr/0001-layered-architecture-with-ports-and-adapters.md).

This isn't just convention — `apps/web/eslint.config.mjs` enforces it with
`no-restricted-imports`:

- `src/domain/**` and `src/services/**` cannot import `next`/`next/*`,
  `react`/`react-dom`, `drizzle-orm`, `firebase`/`firebase-admin`, or
  anything under `adapters/`.
- `src/app/**` cannot import anything under `adapters/` — go through
  `createServices()` from `@/lib/composition` instead.

`pnpm lint` runs these rules; a violation fails the `lint` job in CI and
blocks merge. (`adapters/**` itself has no import restriction today — by
convention it imports vendor SDKs freely and translates to/from
`domain/`/`ports/` types, but nothing stops it importing something it
shouldn't yet. If you're adding a rule here, this is a good next one.)

## Adding a new adapter

Say you're wiring up Resend for real (`src/adapters/resend/`, currently an
empty `export {}` scaffold implementing nothing — see
[`docs/ARCHITECTURE.md` §8](ARCHITECTURE.md#8-what-m0-deliberately-stubs)).

1. **Check the port first.** `Mailer` already exists in
   `src/ports/mailer.ts` (see `src/ports/index.ts` for the full list). If
   the capability you need isn't covered by an existing port, or an
   existing port is too fat for what you're building (ISP — see
   `ListingReader`/`ListingWriter` as the model), design the port before
   writing any adapter code. Ports are interfaces only: no vendor types,
   no framework types.
2. **Implement the port** in `src/adapters/resend/`. This file may import
   the Resend SDK freely — that's the point of the adapter layer. Map
   Resend's request/response shapes to the port's types; don't leak
   Resend-specific types back out through the port.
3. **Wire it into `lib/composition.ts`.** Add the concrete adapter to
   `createServices()` (or the relevant per-environment branch), and inject
   it into whichever service needs a `Mailer`. This is the only file
   allowed to construct adapters and hand them to services.
4. **Write contract tests.** If more than one adapter can satisfy a port
   (e.g. a future Cloudinary `ImageStorage` alongside Firebase's), write
   one shared contract test suite that both must pass — this is what makes
   LSP a tested guarantee, not just a claim (PRD §8.5). Put
   adapter-specific integration tests (against a real or sandboxed vendor
   service) in `tests/integration/`.
5. **Never import the adapter from `app/`.** Route handlers call
   `createServices()` and use the returned service; they never import
   `src/adapters/resend` (or any other adapter) directly. The `lint` job
   catches this if you slip.
6. Update [`docs/ARCHITECTURE.md`](ARCHITECTURE.md) — the "what M0
   deliberately stubs" table (or wherever the adapter's status is
   documented) — so the doc doesn't drift the moment it's merged.

## Definition of done

A change is done when:

- [ ] Tests were written first (or alongside, for straightforward
      refactors) and are green: `pnpm test:unit` at minimum, plus
      `pnpm test:integration` / `pnpm test:e2e` if the change touches an
      adapter or a user-facing journey.
- [ ] `pnpm typecheck`, `pnpm lint`, `pnpm build` are green locally.
- [ ] No boundary violation — `services/`/`domain/` didn't reach for a
      framework or vendor SDK; `app/` didn't reach for `adapters/` directly.
- [ ] `docs/PRD.md`, `docs/ARCHITECTURE.md`, or an ADR is updated if the
      change adds/removes a port, changes a boundary, or changes a
      documented behaviour — don't let the docs drift from the code.
- [ ] No secrets committed. Only placeholders in `.env.example`; real
      values live in Vercel environment variables, scoped per environment.
- [ ] Commit message(s) follow Conventional Commits; the PR squash-merges
      to a single such commit on `main`.
