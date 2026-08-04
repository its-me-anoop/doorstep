# ADR-0001: Layered architecture with ports and adapters

## Status

Accepted — M0.

## Context

Doorstep is built solo (PRD §15, "solo-developer bus factor and burnout" is
a named risk), test-driven from day one (PRD §8.8), and must expose a stable
`/api/v1` contract that a phase-2 Flutter app consumes "unchanged" (PRD §2.3
goal 5, §16). It also depends on several vendor SDKs that carry real
volatility risk: Meilisearch (self-host fallback, PRD §14), Mapbox (MapLibre
fallback, PRD §15), Firebase Storage (Cloudinary swap flagged explicitly,
PRD §8.7), Resend, and Stripe (phase 2).

Two forces are in tension: ship fast as one developer, but do not let
framework and vendor code leak into business logic to the point that (a)
testing requires spinning up real infrastructure for every unit test, (b)
swapping a vendor requires touching call sites all over the codebase, or (c)
the Flutter app's API contract becomes an accidental function of whatever
Next.js or Drizzle happens to expose.

## Decision

Adopt a layered / hexagonal (ports-and-adapters) structure inside
`apps/web/src`, per PRD §8.5:

- `domain/` — pure TypeScript entities, value objects, the listing state
  machine, and policy objects. No framework imports.
- `services/` — use cases that orchestrate domain logic via **ports**
  (interfaces), never via concrete adapters.
- `ports/` — interfaces owned by the domain/services side: `ListingReader`
  and `ListingWriter` (an ISP split of the conceptual `ListingRepository`),
  `UserRepository`, `SearchIndex`, `ImageStorage`, `Mailer`, `Geocoder`,
  `RateLimiter`, `Clock`, `AuthGateway`. An `OutboxRepository` port is
  anticipated for M2, alongside the drain worker (ADR-0005), but does not
  exist yet — M0 has only the `outbox` domain entity and Drizzle table.
- `adapters/` — one folder per vendor (`drizzle/`, `meilisearch/`,
  `firebase/`, `resend/`, `mapbox/`, `upstash/`), each implementing one or
  more ports. In M0 only `adapters/drizzle` (users) and `adapters/firebase`
  (auth) have real implementations; the rest are empty scaffolds.
- `app/` — Next.js routes only: parse request, resolve a service from the
  composition root, call it, map the result to a response.
- `lib/composition.ts` — the single composition root wiring adapters to
  services per environment (dev/test/preview/prod); tests substitute
  in-memory fakes here.

The dependency rule (domain/services → ports only; adapters → ports;
composition root → adapters + services) is enforced in CI's `lint` job via
ESLint's `no-restricted-imports` rule, configured per directory in
`apps/web/eslint.config.mjs` — not left to code review discipline alone.
Today that lint configuration covers two of the three boundaries: what
`domain/`/`services/` may import, and what `app/` may import; `adapters/**`
itself has no dedicated import restriction yet.

## Consequences

**Positive**

- Domain and service tests run without a database, Firebase project, or
  network access — in-memory fakes satisfy the ports, making the
  red-green-refactor loop in PRD §8.8 fast and reliable for a solo
  developer.
- Vendor swaps (Meilisearch → self-hosted, Firebase Storage → Cloudinary,
  Mapbox → MapLibre) are adapter-level changes plus a composition-root
  edit; `domain/` and `services/` are untouched, directly satisfying the
  fallback levers PRD §14/§15 rely on.
- The `/api/v1` contract is shaped by `services/` return types, not by
  whatever Drizzle or Firebase happen to return, which is what makes it
  safe for a phase-2 Flutter client to consume unchanged (PRD §2.3, §16).
- LSP is testable directly: `ImageStorage` implementations (Firebase now,
  Cloudinary later) run against one shared contract test suite (PRD §8.5).

**Negative / accepted costs**

- More files and indirection than writing Drizzle calls straight into
  route handlers — for a solo developer this is deliberately paid up
  front, per PRD §15's framing of "boring architecture" as the mitigation
  for bus-factor risk.
- Every new integration requires a port to be designed, not just an SDK
  call dropped in; this is slower for one-off, unlikely-to-change
  integrations (e.g. postcodes.io) where the abstraction may feel like
  overhead. Accepted because the pattern is uniform and predictable rather
  than judged case by case.
- ESLint boundary rules require ongoing maintenance as new directories are
  added (e.g. a future `packages/` shared types package) — and, as noted
  above, do not yet cover every layer (`adapters/**` has no rule of its
  own).

## Alternatives rejected

- **Fat-controller / route-handler-does-everything.** Fastest to start,
  but couples business logic to Next.js and Drizzle from day one, makes
  unit testing require a real Postgres connection, and makes the Flutter
  API contract an accident of implementation. Rejected — directly
  conflicts with PRD §2.3 goal 5 and the TDD requirement in §8.8.
- **Full microservices / separate backend service.** Unwarranted at MVP
  scale (PRD §7.1: 10k listings, 50k monthly visitors) and for a
  one-developer team; adds deployment, networking and operational surface
  with no corresponding benefit. Rejected as premature.
- **Repository pattern without a ports/adapters split (Drizzle repos
  called directly from services).** Simpler, but couples services to
  Drizzle's types and makes swapping the ORM or introducing in-memory test
  doubles harder. Rejected in favour of the explicit `ports/` layer,
  which costs little extra and pays for itself in the LSP/DIP guarantees
  above.
