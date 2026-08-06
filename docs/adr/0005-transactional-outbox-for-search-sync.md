# ADR-0005: Transactional outbox for Postgres-to-Meilisearch sync

## Status

Accepted — M0 (schema only). The drain worker and nightly reconciliation
job landed in M2 alongside search itself, per this ADR's design — see
`docs/ARCHITECTURE.md` §14/§15 and ADR-0008 for the as-implemented detail.

## Context

Given Postgres-as-source-of-truth / Meilisearch-as-projection (ADR-0003),
the two systems need a synchronisation mechanism. PRD §9.3 requires that
"every transition writes to the outbox so search visibility follows within
a minute," and PRD §6.5 (LST-5) requires status transitions to "update
search visibility within 1 minute via the index sync." PRD §7.6 requires
Meilisearch to be fully rebuildable from Postgres by one command, and PRD
§7.7 requires an alert on "outbox backlog > 500." PRD §15 names index drift
("Postgres vs Meilisearch disagree") as a named medium-likelihood,
medium-impact risk, with the mitigation already specified: "transactional
outbox, nightly reconciliation, count-mismatch alert; index rebuildable in
minutes."

The failure mode to design against: a process crash or partial failure
between "commit the Postgres mutation" and "push the change to
Meilisearch" must never silently lose a sync event.

## Decision

An `outbox` table (PRD §9.2: `property_id`, `op` enum `upsert`/`delete`,
`enqueued_at`, `processed_at` null) is written to **in the same database
transaction** as any visibility-relevant mutation to a `properties` row
(publish, edit while published, status transition, unpublish/hide).
Because the outbox row and the domain mutation share one transaction, they
either both commit or both roll back — there is no window where a listing
changes state in Postgres without a corresponding sync event being durably
recorded.

A Vercel Cron worker drains the outbox every minute: for each unprocessed
row, it fetches the current listing state from Postgres, computes the
Meilisearch document (or a delete, if the listing is no longer publicly
visible), upserts/deletes it in Meilisearch, and marks the outbox row
processed. A nightly full reindex job independently rebuilds the entire
index from Postgres and reconciles any drift; a count-mismatch check
between Postgres's count of publicly-visible listings and Meilisearch's
document count triggers an alert (PRD §7.7).

Only publicly visible statuses (`published`, `under_offer`) are ever
present in the index; every other status produces a `delete` op.

## Consequences

**Positive**

- Sync durability does not depend on the sync worker being available at
  the moment of mutation — the outbox row is committed regardless, and
  the worker catches up whenever it next runs. This is what makes the
  "search visibility within 1 minute" target (PRD §6.5, §9.3) achievable
  without coupling listing mutations to Meilisearch's availability or
  latency.
- Meilisearch downtime cannot block a listing mutation (publish, status
  change) from succeeding in Postgres — directly supporting the graceful
  degradation requirement in PRD §7.6.
- The nightly full reindex plus count-mismatch alert gives a second,
  independent correctness check that catches bugs in the incremental
  drain path (e.g. a mapping bug that silently produces wrong documents)
  that the outbox mechanism alone would not catch.
- The pattern generalises: any future consumer of "listing changed"
  events (e.g. a phase-2 saved-search alert digest) can read the same
  outbox table or a similarly-shaped one, rather than each new consumer
  inventing its own polling/webhook mechanism.

**Negative / accepted costs**

- Adds an extra table and a background worker to operate, monitor and
  alert on — nontrivial for a solo developer, but directly specified by
  the PRD as the risk mitigation, and worker logic can be unit-tested
  against an in-memory `OutboxRepository` and `SearchIndex` fake without
  real infrastructure (ADR-0001) once that port is written.
- Search visibility is _eventually_ consistent, not immediate — a
  same-second read of `/api/v1/search` immediately after a publish can
  still show stale results for up to the drain interval. This is an
  accepted trade-off explicitly bounded by the PRD's own "within 1 minute"
  target (PRD §6.5, §9.3), not an open-ended promise.
- In M0, the `outbox` table and its Drizzle types are created, but no
  service yet writes to it (there is no publish/status-change use case
  until M1) and no worker drains it (Meilisearch is not indexed until
  M2). The Vercel Cron entry is scaffolded as a safe no-op so the
  operational shape (cron job registered, monitoring hook present) exists
  before the behaviour does.

## Alternatives rejected

- **Synchronous dual-write** (write Postgres and Meilisearch in the same
  request handler, no outbox). Simpler, but a crash or Meilisearch
  timeout after the Postgres commit permanently desyncs the two systems
  with no record that a sync was owed. Rejected — this is precisely the
  drift risk PRD §15 flags.
- **Postgres logical replication / CDC (e.g. Debezium) into Meilisearch.**
  Removes the need for an application-level outbox table and worker, but
  is materially more operational machinery (a CDC connector, a message
  broker or sink) than a solo-developer MVP at 10k listings justifies.
  Rejected as disproportionate; revisit if listing volume or write rate
  grows enough that a once-a-minute cron drain becomes a bottleneck.
- **Poll `properties.updated_at` directly instead of a dedicated outbox
  table.** Avoids a new table, but cannot distinguish "needs re-indexing"
  from "updated for an unrelated reason," cannot represent deletes
  cleanly (a row that becomes privately visible still has an
  `updated_at`, not an absence), and provides no natural backlog-size
  signal for the PRD §7.7 alert. Rejected in favour of an explicit outbox.
