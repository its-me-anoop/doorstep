# ADR-0003: Postgres/PostGIS as source of truth, Meilisearch as a disposable projection

## Status

Accepted — M0 (schema/extension only). Search itself — the Meilisearch
projection, sync and public API this ADR designs for — landed in M2; see
`docs/ARCHITECTURE.md` §13–§17.

## Context

PRD §8.1 locks Neon Postgres + PostGIS as the source of truth and
Meilisearch Cloud (EU) for geo-faceted search, on the stated reasoning that
"relational + geospatial is exactly the property domain" and Meilisearch
gives millisecond faceted search with built-in `_geoRadius`/`_geoBoundingBox`
that maps 1:1 to radius and map-viewport search (PRD §8.6). PRD §7.6
explicitly requires that Meilisearch be treated as disposable state,
"fully rebuildable from Postgres by one command," removing the search
index from the backup-criticality path, and that search be allowed to
degrade gracefully (friendly outage state) while everything Postgres-backed
(detail pages, dashboards, enquiries) keeps working. PRD §7.1 sets the
performance target this split must hit: search API p75 < 500ms at 10k
listings / 20 RPS sustained.

## Decision

Postgres is the only system of record for property, user, agency, enquiry
and moderation data. Meilisearch holds a **read-optimised projection** of
publicly visible listings only (published, under_offer), synced via a
transactional outbox (ADR-0005) and reconciled nightly. No write ever goes
to Meilisearch first, and no domain rule is ever evaluated against
Meilisearch data — it exists purely to serve `GET /api/v1/search` fast.

Concretely (PRD §8.6, restated for traceability):

- Document shape: id, channel, title, displayAddress, town, outcode,
  propertyType, bedrooms, bathrooms, price, priceQualifier, tenure,
  furnished, availableFrom, newHome, features, coverImageUrl, imageCount,
  agency {id, name, logo}, publishedAt, `_geo {lat, lng}`.
- Filterable: channel, price, bedrooms, bathrooms, propertyType, tenure,
  furnished, newHome, town, outcode, `_geo`. Sortable: price, publishedAt.
  Searchable text kept minimal (title, displayAddress, town, outcode) —
  discovery here is geo-driven, not full-text-driven.
- PostGIS's `geography(Point, 4326)` column with a GIST index remains the
  authoritative location store and is available as a reconciliation/
  fallback query path even though Meilisearch serves the hot path.

## Consequences

**Positive**

- Meilisearch can be deleted and rebuilt with a single reindex command
  with zero data loss, satisfying PRD §7.6's backup-criticality
  requirement directly — it never needs its own backup regime.
- Search outages degrade gracefully: everything Postgres-backed (detail
  pages via ISR, dashboards, enquiries) keeps working, satisfying the
  reliability target in PRD §7.6.
- Meilisearch's native `_geoRadius`/`_geoBoundingBox` filters map exactly
  onto the two search UX modes the PRD specifies (radius search, and
  "search as I move the map"), avoiding hand-built geo-query logic in the
  application layer.
- Both vendor risk and cost risk are hedged: Meilisearch sits behind the
  `SearchIndex` port (ADR-0001), so a self-hosted fallback (PRD §14, §15)
  is an adapter swap.

**Negative / accepted costs**

- Two systems must agree, which means an entire class of "index drift"
  bugs exists that would not exist with a single system; mitigated by the
  outbox pattern, nightly full reindex, and a count-mismatch alert
  (ADR-0005, PRD §7.7).
- Every visibility-relevant mutation must remember to write both the
  Postgres row and the outbox row in the same transaction — a discipline
  enforced by putting the outbox write inside the same service-layer use
  case as the mutation, not left to individual call sites.
- M0 provisions the Meilisearch project and reserves the port/adapter
  shape but does not index anything or serve real search traffic — the
  index configuration and sync worker are exercised starting M2. This is
  an explicit scope cut from full MVP behaviour, not an oversight.

## Alternatives rejected

- **Postgres full-text + PostGIS only, no separate search engine.**
  Would avoid a second system entirely and remove the drift risk. Rejected
  because Meilisearch's faceted counts, typo tolerance, and
  `_geoBoundingBox` viewport queries at the target latency (p75 < 500ms,
  PRD §7.1) are materially cheaper to get right in Meilisearch than to
  hand-roll in SQL, and the PRD locks Meilisearch as the chosen search
  layer.
- **Elasticsearch/OpenSearch.** More powerful and more operationally
  heavy than the MVP needs (10k listings); no EU-hosted managed offering
  as cheap or as simple to operate solo as Meilisearch Cloud. Rejected as
  disproportionate for MVP scale (PRD §7.1, §14).
- **Algolia.** Comparable DX to Meilisearch but materially higher cost at
  the MVP's scale and less favourable self-host fallback story (PRD §14's
  cost-mitigation lever explicitly names self-hosted Meilisearch).
  Rejected on cost/optionality grounds.
- **Write-through dual-write (write to Postgres and Meilisearch in the
  same request, no outbox).** Simpler to build but not transactionally
  safe — a crash between the two writes leaves them permanently out of
  sync with no reconciliation mechanism. Rejected in favour of the outbox
  (ADR-0005), which is what PRD §7.6 and §15 both assume.
