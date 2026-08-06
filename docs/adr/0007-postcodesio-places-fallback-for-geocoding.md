# ADR-0007: postcodes.io Places as the default free-text geocoding fallback

## Status

Accepted — M2.

## Context

PRD §8.6 names Mapbox Geocoding as _the_ free-text place-search provider
for M2's search feature: "input matching the UK postcode pattern goes to
postcodes.io ... anything else goes to Mapbox Geocoding with GB bias."
PRD §10 (SRCH-1) and §6.1's acceptance criteria require that "place names
resolve via geocoding suggestions biased to GB" as part of `GET
/api/v1/geocode?q=`'s M2 scope, independent of which vendor serves them.

No `MAPBOX_ACCESS_TOKEN` is provisioned in this project's local or CI
environments today (see `.env.example`'s own note, and PRD §14's running-
costs table, which schedules Mapbox spend around the M3 map view rather
than M2). Blocking M2's search-and-geocode-suggestions work on first
signing up for a Mapbox account and provisioning a token in three
environments (dev/preview/prod, PRD §7.4) would stall an otherwise-ready
milestone on an account-creation step with no engineering content, and
would leave every M2 integration test that exercises free-text place
search either skipped everywhere or dependent on a real, rate-limited
third-party API key existing in CI.

postcodes.io — already the M1 postcode-fast-path provider
(`adapters/postcodesio/`, ADR-implicit in `docs/ARCHITECTURE.md` §12) —
exposes its own free, keyless Places API, backed by Ordnance Survey Open
Names (OS Open Names GB): a separate, free, open dataset from the
postcode-lookup endpoints M1 already calls, covering place/feature names
rather than postcodes. It requires no signup, no key, and no per-request
cost, and needs zero new infrastructure beyond what M1 already wired.

## Decision

`ports/geocoder.ts` splits `Geocoder` per ISP into `PostcodeGeocoder`
(unchanged from M1) and a new `PlaceSearcher`
(`searchPlaces(query): Promise<PlaceSuggestion[]>`). Two concrete
adapters implement `PlaceSearcher`:

- `adapters/mapbox/`'s `MapboxGeocoder` — real, complete, GB-biased,
  calling Mapbox's v5 forward-geocoding endpoint with
  `autocomplete=true`. Unit-tested against a mocked `fetch`
  (`tests/unit/adapters/mapbox/`) and exercised for real by
  `tests/integration/mapbox-geocoder.test.ts` whenever a token is
  available (`skipIf`s cleanly otherwise) — this is a fully-built, not a
  half-built, adapter.
- `adapters/postcodesio/`'s own `searchPlaces` method — real, complete,
  calling postcodes.io's Places API (OS Open Names GB).

`src/lib/composition.ts` wires `PlaceSearcher` to `MapboxGeocoder` **only
when `MAPBOX_ACCESS_TOKEN` is set** on the running environment; when it
is unset, `adapters/postcodesio/`'s `searchPlaces` is wired instead — the
**default**, not a temporary stand-in with different behaviour or a
degraded feature set. `services/geocoding/search-geocode.ts`'s
`SearchGeocode` use case depends only on the `PlaceSearcher` interface
and has no idea which adapter is behind it; callers of
`GET /api/v1/geocode?q=` see one consistent response shape
(`{ kind: 'place', name, label, lat, lng, outcode }`) regardless of
provider.

This makes the provider a **per-environment, env-var-driven choice**:
local dev and CI run on the postcodes.io fallback today; setting
`MAPBOX_ACCESS_TOKEN` on any environment (dev, preview, or prod
individually) switches that environment to Mapbox with no code change,
per PRD §7.4's "separate environments, no shared credentials" model.

## Consequences

**Positive**

- M2's search and geocode-suggestion work shipped without waiting on a
  third-party account to be created and funded — the `PlaceSearcher`
  port made the provider swappable from day one, so "which vendor" never
  blocked "does the feature work."
- Every environment gets working free-text place search out of the box,
  including CI (`tests/integration/postcodesio-geocoder.test.ts` needs
  only live network access to postcodes.io, no secret) — a stronger
  default test posture than requiring a Mapbox key to exercise this path
  at all.
- The swap is genuinely free: `adapters/mapbox/`'s code is complete and
  tested regardless of whether a token exists anywhere yet, so turning
  Mapbox on later (per PRD §8.6's original intent, e.g. for its richer
  match ranking or POI coverage ahead of the M3 map view needing a Mapbox
  account anyway) is an environment-variable change, not a build.
- Both providers satisfy the same `PlaceSearcher` contract and are
  exercised by the same caller (`SearchGeocode`), so this is LSP holding
  in practice, not just in theory — a future third provider (or a
  self-hosted Photon/Nominatim instance) is another adapter, not a
  `SearchGeocode` rewrite.

**Negative / accepted costs**

- This is an explicit, documented deviation from PRD §8.6's literal
  prose ("anything else goes to Mapbox Geocoding") — flagged here rather
  than silently diverging, and called out again in the adapter's own doc
  comment (`adapters/mapbox/index.ts`) and in `docs/ARCHITECTURE.md` §17.
- OS Open Names is place/feature data, not postcode data — a
  `postcodesio` place result never carries a specific outcode
  (`PlaceSuggestion.outcode` is `null`), whereas a real Mapbox result
  might resolve closer to a specific area. This is a minor precision gap
  in the confirmation label shown to the user ("good enough, not
  authoritative," the same standard §12 already applies to the postcode
  label), not a correctness gap in the coordinates returned.
- Running two provider code paths (Mapbox, postcodes.io Places) instead
  of one is marginally more surface to maintain than a single hard-coded
  vendor — accepted because the ISP split (`PlaceSearcher`) was already
  the right shape for testability regardless of this decision, so the
  second adapter is additive, not a structural cost.

## Alternatives rejected

- **Block M2 on provisioning a Mapbox account first.** Rejected: turns an
  engineering milestone into a blocked-on-account-creation milestone for
  no functional gain, and leaves CI with no way to exercise free-text
  search without a live, potentially rate-limited third-party key
  checked into repository secrets.
- **A different keyless geocoder (e.g. self-hosted Nominatim/Photon, or
  OpenCage's free tier).** Rejected: postcodes.io is already a trusted,
  wired-in, zero-infrastructure dependency as of M1 (ADR-implicit,
  `docs/ARCHITECTURE.md` §12) with a Places endpoint that needs no new
  vendor relationship, no new adapter category, and no additional
  infrastructure to operate — strictly less to add than any alternative
  considered.
- **Return an empty result for free-text queries until Mapbox is
  provisioned.** Rejected: fails PRD §10 SRCH-1's and §6.1's explicit
  acceptance criteria (place-name search must work, not just postcode
  search) for the entire M2 milestone, for a cost (using a free API
  that's already integrated) that does not justify the feature gap.
