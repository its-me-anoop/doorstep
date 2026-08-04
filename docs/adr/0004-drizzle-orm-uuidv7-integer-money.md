# ADR-0004: Drizzle ORM, UUID v7 primary keys, integer money

## Status

Accepted — M0.

## Context

PRD §8.1 selects Drizzle ORM + drizzle-kit, described as TypeScript-first,
SQL-transparent, and compatible with PostGIS custom types, with Prisma
named as an acceptable alternative. PRD §9 fixes two data-modelling rules
across every table: `id` is UUID v7, and money is stored as integer pounds
(sale) or integer pcm (rent) — "no floats." These are foundational decisions
that every subsequent milestone's schema work depends on, so they belong in
M0 alongside the initial Drizzle schema and migrations.

## Decision

**ORM: Drizzle ORM + drizzle-kit** for schema definition and migrations.
Schema lives in `apps/web/src/adapters/drizzle/schema.ts`, migrations in
`apps/web/src/adapters/drizzle/migrations/`, and `drizzle-kit`'s config at
`apps/web/drizzle.config.ts` points at both. The same `adapters/drizzle/`
directory implements the repository ports (ADR-0001) and is the only code
that imports `drizzle-orm` directly.

**Primary keys: UUID v7** on every table, generated application-side via
the `uuidv7` package (`$defaultFn(() => uuidv7())` in the schema). Chosen
over UUID v4 and over serial/bigint integers.

**Money: integer columns**, pounds for sale prices, pcm for rents — no
`numeric`/`decimal`, no floating point, ever. `deposit` (rent) is also
integer pounds.

## Consequences

**Positive**

- Drizzle's TypeScript-first schema gives compile-time-checked query
  building and migration files that are plain SQL-transparent artifacts
  reviewable in PRs — matching the "boring architecture" mitigation for
  solo-developer risk (PRD §15).
- Drizzle's support for custom/raw SQL types is what makes the
  `geography(Point, 4326)` PostGIS column (ADR-0003) representable in the
  schema (`src/adapters/drizzle/custom-types.ts`) without dropping to raw
  SQL for every geo query.
- UUID v7 is time-ordered, so indexes on `id` (and any keyset pagination
  that uses `id` as a tiebreaker) do not suffer the random-insert B-tree
  fragmentation that UUID v4 causes at scale, while still being safe to
  expose in public URLs (`/api/v1/properties/{slug}` uses `slug`, but
  admin/internal APIs reference `id` directly) without leaking row counts
  the way auto-increment integers do.
- Integer money makes arithmetic exact — no rounding-error class of bugs
  in price comparisons, filters, or sort order — and is sufficient because
  Doorstep is GBP-only, whole-pound-denominated (no pence shown anywhere
  in the product) for the MVP.

**Negative / accepted costs**

- Drizzle is a smaller ecosystem than Prisma; fewer community adapters
  and generators. Accepted because SQL-transparency and first-class custom
  type support for PostGIS outweigh ecosystem size at this scale, and the
  PRD names it as the chosen option.
- UUID v7 support in tooling (drivers, admin UI generators) is newer than
  UUID v4; a small compatibility-checking cost was paid during schema
  design to confirm Neon/Postgres and Drizzle handle it natively via the
  application-side `uuidv7` generator.
- Integer-pounds money means the schema cannot represent sub-pound amounts
  (e.g. pence-level Stripe fees in phase 2 `payments` rows) without a
  documented convention; the `payments` table (reserved in M0's schema per
  PRD §9.2) will need its own `amount`/`currency` convention decided
  before phase 2, separate from `properties.price`. Flagged, not solved,
  in M0.

## Alternatives rejected

- **Prisma ORM.** PRD §8.1 names it the acceptable alternative; rejected
  in favour of Drizzle specifically for SQL transparency and smoother
  PostGIS custom-type handling, which matters more here than Prisma's
  more polished DX given the geospatial-heavy schema.
- **UUID v4 primary keys.** Simpler, more universally supported, but
  random ordering causes B-tree index bloat under sustained insert load
  and offers no ordering signal for pagination. Rejected in favour of
  UUID v7's ordering benefits at negligible extra cost.
- **Auto-increment integer/bigint primary keys.** Best index locality and
  simplest possible implementation, but leaks sequential information
  (listing counts, growth rate) when exposed in URLs or APIs, and is a
  poor fit for a public-facing marketplace where competitors could infer
  business metrics from ID sequences (PRD §15 names scraping/competitive
  observation as a risk). Rejected.
- **Decimal/numeric columns for money.** Avoids the "no floats" problem
  differently by using arbitrary-precision decimal types. Rejected as
  unnecessary complexity: the product never displays sub-pound amounts,
  so integer pounds is simpler and exactly matches the PRD's explicit
  instruction (PRD §9).
