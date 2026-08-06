# ADR-0008: Clear-then-rebuild for the nightly reindex job

## Status

Accepted — M2.

## Context

ADR-0003 established Meilisearch as a disposable projection of Postgres,
rebuildable from scratch at any time. ADR-0005 established the
transactional outbox as the incremental sync mechanism, and named "a
nightly full reindex reconciles drift" as its second, independent
correctness check — the outbox drain worker (`docs/ARCHITECTURE.md` §14)
catches most sync events within a minute, but a bug in the incremental
path (a mapping error, a missed outbox write, a Meilisearch write that
silently produced a wrong document) would not be caught by the same
mechanism that might contain the bug. PRD §7.6 requires Meilisearch to be
"fully rebuildable from Postgres by one command," and PRD §7.7 requires
an alert on index drift; PRD §15 names "search index drift (Postgres vs
Meilisearch disagree)" as a named, medium-likelihood/medium-impact risk
with "transactional outbox, nightly reconciliation, count-mismatch alert;
index rebuildable in minutes" as its stated mitigation.

The question this ADR answers: when the nightly job runs, _how_ does it
reconcile Postgres against Meilisearch — compute a minimal diff and patch
only what's wrong, or start from a known-empty index and rebuild
everything?

## Decision

`RebuildSearchIndex` (`src/services/search-sync/rebuild-search-index.ts`)
does the simplest thing that satisfies the requirement: it calls
`SearchIndex.clear()` (delete every document, settings untouched), then
pages through every currently-indexable listing in Postgres
(`ListingReader.listIndexable`, `published`/`under_offer` only) and
upserts each page. `GET /api/cron/reindex`
(`src/app/api/cron/reindex/route.ts`) runs this once nightly via
`apps/web/vercel.json`'s `"0 3 * * *"` Vercel Cron entry (03:00 UTC) —
the UK's lowest-traffic search hour, chosen specifically because this
approach means the index is briefly emptier than it should be while the
rebuild is in flight.

The alternative — enumerate every document id currently in the index,
diff it against Postgres's indexable-id set, and issue targeted
upserts/deletes only for what's actually wrong — was considered and
rejected for this milestone. `ports/search-index.ts`'s `SearchIndex` port
has no "list every id" method: `search()` is query-scoped (it returns a
page of hits for a filter expression, not an unbounded dump of the whole
index), and building one — plus the pagination/consistency logic to walk
an entire Meilisearch index reliably — is speculative surface this
milestone does not otherwise need, purely to serve a once-a-night job.

Drift is still detected, just not prevented during the brief rebuild
window: `execute()` captures `ListingReader.countIndexable()` (Postgres,
before) and `SearchIndex.countDocuments()` (Meilisearch, before) up
front, and re-reads the Meilisearch count after the rebuild completes. A
mismatch between the pre-rebuild Postgres count and the post-rebuild
Meilisearch count is logged via `console.warn` — the detectable-signal
half of PRD §7.7's drift-alert requirement; routing that signal to an
actual alert channel (Sentry, PagerDuty, email) is not yet wired in this
codebase and is called out as a gap in `docs/ARCHITECTURE.md` §15, not
silently assumed solved.

## Consequences

**Positive**

- Correct by construction: the end state after every run is _exactly_
  what Postgres says right now, nothing else — no accumulated orphans
  from a missed delete, no possibility of the diff logic itself having a
  bug that leaves a stale document behind. This is the strongest possible
  interpretation of ADR-0003's "disposable projection" framing, applied
  literally rather than approximated.
- Materially simpler to implement, test and reason about than a
  diff-and-patch job: no new "enumerate the index" capability on the
  `SearchIndex` port, no id-set diffing logic, no separate code path for
  "documents that are wrong" vs "documents that are missing" vs
  "documents that shouldn't exist."
- The same code path this ADR describes is directly reusable as the
  disaster-recovery / cold-start rebuild PRD §7.6 calls for ("fully
  rebuildable from Postgres by one command") — there is exactly one
  reindex mechanism in this codebase, not a nightly one and a separate
  manual-recovery one that could drift apart from each other.
- `scripts/reindex-local.ts` and `scripts/seed-search-5k.ts` both reuse
  (or deliberately bypass, for `seed-search-5k.ts`'s own documented
  reasons — see that script's header comment) this same use case, so
  local development, CI, and production all exercise one reindex
  implementation.

**Negative / accepted costs**

- A brief window exists, once a night, where the index has fewer
  documents than it should — search results during that window
  (typically seconds to low minutes at the MVP's 10k-listing scale,
  PRD §7.1) could under-return. Scheduled at 03:00 UTC specifically to
  minimise real user impact; not eliminated, because eliminating it
  entirely is exactly the added complexity (double-write to a shadow
  index, or the diff-and-patch approach) this decision declines to take
  on for an MVP-scale, solo-developer project.
- The job's cost is O(every indexable listing) every night, regardless of
  how much (if anything) actually drifted since the previous run — a
  diff-and-patch approach would in principle do less work on a quiet
  night. Accepted because at PRD §7.1's target scale (10k listings) a
  full rebuild is cheap in absolute terms (the same order of magnitude of
  work `seed-search-5k.ts`'s bench tooling exercises for a _single_ run),
  and "cheap but constant" was judged preferable to "usually cheaper, but
  with more moving parts that can themselves drift or fail" for this
  milestone.
- Drift _detection_ (the count-mismatch `console.warn`) is real, but
  drift _alerting_ (paging a human) is not yet wired — an accepted,
  explicitly documented gap (see `docs/ARCHITECTURE.md` §15), not a claim
  that PRD §7.7's alert requirement is fully closed by this ADR alone.

## Alternatives rejected

- **Diff-and-patch**: enumerate every Meilisearch document id, diff
  against Postgres's indexable-id set, upsert/delete only the
  discrepancies. Rejected for this milestone: needs a new `SearchIndex`
  capability this port doesn't have and the PRD doesn't otherwise call
  for, is materially more code to get right (pagination through an
  entire index reliably, handling the diff itself having edge cases), and
  buys a smaller no-empty-window benefit that the clear-then-rebuild
  approach already accepts as a scheduled, bounded trade-off. Worth
  revisiting if listing volume grows enough that a nightly full rebuild's
  duration or cost becomes a real operational concern — not the case at
  PRD §7.1's MVP scale.
- **Postgres logical replication / CDC into Meilisearch for
  reconciliation too** (mirroring ADR-0005's own rejection of CDC for the
  incremental path, for the same reasons). Rejected as disproportionate
  operational machinery for a solo-developer MVP; the outbox already
  covers the incremental path, and this ADR only concerns the once-a-
  night backstop.
- **Blue-green reindex** (build a second, freshly-populated index, then
  atomically swap which index name the app reads from) — eliminates the
  brief empty-index window entirely. Rejected for this milestone as
  additional complexity (index-alias management, a second index's worth
  of Meilisearch resource usage during the swap) disproportionate to a
  once-a-night, low-traffic-hour window at MVP scale; the `SearchIndex`
  port's `resolveMeilisearchIndexName` is a pure function of env vars
  today specifically because no alias-swapping exists yet — revisit
  alongside real alerting if the empty-window trade-off ever proves
  costly in practice.
