# ADR-0009: MapLibre GL JS + OpenFreeMap as the map view's default provider, Mapbox GL JS optional

## Status

Accepted — M3.

## Context

PRD §8.1's stack table names Mapbox GL JS as the map view's tile
provider. PRD §14's running-costs table separately budgets "~$0 within
50k loads, budget ~$25 headroom" for Mapbox at MVP scale, and PRD §15's
risk register names the exact mitigation for that budget line turning
out wrong: "the two levers if costs bite: self-host Meilisearch... and
swap Mapbox GL for MapLibre + OpenFreeMap tiles behind the existing map
component boundary." M3-DESIGN-SPEC.md §0 goes further and decides the
lever up front, before any UI work: "MapLibre GL JS + OpenFreeMap tiles
by default, Mapbox GL when a token is configured... not a downgrade from
the PRD's stack line — it's the exact documented fallback the PRD's own
risk register already names."

No `NEXT_PUBLIC_MAPBOX_ACCESS_TOKEN` is provisioned in this project's
local, CI, or (as of this milestone) any hosted environment. Blocking
M3's map-view work on first signing up for a Mapbox account and
provisioning a billable token across dev/preview/prod (PRD §7.4's
"separate environments, no shared credentials" model) would stall an
otherwise-ready milestone on an account-and-billing step with no
engineering content — the same shape of problem ADR-0007 already solved
for the geocoding half of this product by defaulting to postcodes.io
instead of blocking on Mapbox there too.

OpenFreeMap (`https://tiles.openfreemap.org/styles/liberty`) serves a
Positron-family vector style — light, near-monochrome, free, with no
signup, no key, and no per-request cost or load quota to track. MapLibre
GL JS is a permissively-licensed fork of Mapbox GL JS taken before
Mapbox's own licence change, so it exposes a near-identical runtime API
(`Map`, `Marker`, `Popup`, `NavigationControl`, `AttributionControl`,
event names, clustered-GeoJSON-source semantics) — a fork close enough
that one shared adapter core can drive either library through a single
small structural interface, rather than two independently-maintained
integrations.

## Decision

`src/components/features/search/map/map-adapter.ts` defines `MapAdapter`
— the small, ISP-scoped interface `map-view.tsx` programs against
(`init`, `setData`, `on('select'|'moveend'|'tilesFailed', ...)`,
`setHighlightedHit`, `openPopup`/`closePopup`, `destroy`, plus
`flyTo`/`jumpTo` via `CameraCapableMap`). Two adapters implement it:

- `maplibre-adapter.ts`'s `createMapLibreAdapter()` — MapLibre GL JS
  against OpenFreeMap's `liberty` style. **The default.**
- `mapbox-adapter.ts`'s `createMapboxAdapter(accessToken)` — Mapbox GL
  JS against `mapbox://styles/mapbox/light-v11`. Wired in **only** when
  `NEXT_PUBLIC_MAPBOX_ACCESS_TOKEN` is set on the running environment.

Both wrap one shared implementation, `gl-map-adapter.ts`'s
`createGlMapAdapter(gl: GlLibrary, styleUrl: string)`, against a small
injected `GlLibrary` type covering only the handful of classes this
adapter actually touches — the marker-sync, cluster-click-zoom, and
event-wiring logic is written once, not duplicated per provider.

`create-map-adapter.ts`'s `createMapAdapter()` is the **only** place the
choice between the two is made: it reads
`NEXT_PUBLIC_MAPBOX_ACCESS_TOKEN` and dynamically `import()`s whichever
provider module applies. `map-view.tsx` calls `createMapAdapter()` and
works entirely against the returned `MapAdapter` — no MapLibre or Mapbox
type ever crosses that boundary outward. `NEXT_PUBLIC_` because Mapbox GL
JS (when active) runs client-side and needs the token in the browser
bundle; the flag is a genuinely public, non-secret value, the same
reasoning already applied to the Firebase client config.

Every visual decision the map view makes (M3-DESIGN-SPEC.md §1.1's
basemap tint, §1.2/§1.3's pin/cluster styling, the popup override) is
specified as CSS targeting the map's own DOM — an engine-agnostic
`.map-canvas-container canvas` filter and HTML-marker/popup styling, never
a Mapbox-Studio custom style or per-provider paint-JSON. The design ships
identically regardless of which adapter is live, so switching providers
is never also a design-review event.

## Consequences

**Positive**

- M3 shipped, and every real user today gets a working map, with zero
  Mapbox account, billing setup, or token provisioning required
  anywhere — the same "don't block engineering on account creation"
  benefit ADR-0007 already banked for geocoding.
- The swap PRD §15 names as a cost-control lever is genuinely a
  configuration change, not a future engineering project: setting
  `NEXT_PUBLIC_MAPBOX_ACCESS_TOKEN` on any single environment
  (dev/preview/prod independently, per PRD §7.4) switches that
  environment to Mapbox GL JS with no code change and no redeploy of
  adapter code, only an env var and a rebuild.
- `mapbox-adapter.ts` is complete and real, not a stub — unit-tested
  against a mocked `mapbox-gl` module
  (`tests/unit/components/features/search/map/mapbox-adapter.test.ts`)
  through the exact same `gl-map-adapter.ts` core the MapLibre path
  exercises for real, so LSP holds in practice for this pair the same
  way it does for `PlaceSearcher`'s two implementations (ADR-0007) — a
  future flip to Mapbox is turning a tested path on, not writing one.
- `create-map-adapter.ts`'s dynamic `import()` per provider (not a
  static import of both at module scope) means the unused library's
  ~200KB+ runtime never reaches the browser either way — choosing
  MapLibre as the default doesn't just avoid Mapbox's *pricing*, it
  avoids shipping Mapbox's *code* to anyone who never needed it.
- Reuses, rather than re-litigates, the exact reasoning and structural
  pattern ADR-0007 already established for the unrelated geocoding
  provider choice — one recognisable "optional paid vendor behind a
  free default, selected by an env var, at a documented boundary"
  pattern in this codebase, not two different ones.

**Negative / accepted costs**

- OpenFreeMap is a community-run, donation-funded tile service with no
  formal SLA — a real availability risk MapLibre's own §1.8 point 3
  "tiles failed" state exists specifically to degrade gracefully from
  (base tiles and search results are independent failure domains; a
  tile outage shows "Map tiles aren't loading right now... View as a
  list," not a broken page). Mapbox's own SLA-backed tile CDN would not
  have this specific risk — accepted, because the fallback UX already
  has to exist regardless (a commercial tile CDN can fail too), and
  because "free and slightly less guaranteed" is the correct trade for
  a pre-revenue MVP over "paid and marginally more guaranteed."
- Running two provider code paths (MapLibre, Mapbox) is marginally more
  surface than shipping one hard-coded vendor — accepted for the same
  reason ADR-0007 accepted it for geocoding: the `MapAdapter` seam was
  already the right shape for testability and PRD §15's own stated risk
  mitigation regardless of this specific decision, so the second
  adapter is additive, not a structural cost this milestone introduced
  on its own.
- MapLibre's Positron-style tiles and Mapbox's `light-v11` style are
  visually close but not byte-identical (label density, road-hierarchy
  rendering details differ slightly between vendors' own cartography) —
  an accepted, minor visual variance between the two paths that a
  design review should expect and not treat as a regression if/when the
  Mapbox path is ever switched on for real.

## Alternatives rejected

- **Ship only Mapbox GL JS, matching PRD §8.1's stack table literally.**
  Rejected: blocks the entire M3 milestone on Mapbox account creation and
  billing setup for no functional gain over the fallback the PRD's own
  risk register already names, and leaves every environment (including
  CI's `m3.smoke.spec.ts`, which needs to render the map shell with no
  live credentials) with no way to exercise the map view at all until
  that account exists.
- **Ship only MapLibre + OpenFreeMap, drop the Mapbox path entirely.**
  Rejected: PRD §15 frames the swap as a lever to pull *if* costs bite,
  not a permanent decision to never use Mapbox — keeping the tested,
  code-complete `MapboxAdapter` behind the same boundary costs
  comparatively little (one more adapter behind an interface that
  already has to exist) and preserves the option PRD §14 explicitly
  costs into the running-costs table, without committing to it before
  there's a reason to.
- **A self-hosted tile server (e.g. TileServer GL over a self-hosted
  OpenMapTiles extract) instead of OpenFreeMap.** Rejected for M3: adds
  real infrastructure to operate (storage for the tile extract, a
  running service, its own uptime to manage) for a benefit — control
  over SLA — that OpenFreeMap's free hosted service already provides
  well enough for MVP scale; revisit only if OpenFreeMap's own
  reliability becomes a demonstrated problem, at which point it competes
  against simply flipping the existing Mapbox token on, which needs no
  new infrastructure at all.
