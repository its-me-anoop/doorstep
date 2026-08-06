/**
 * m3.smoke.spec.ts — CI-safe M3 coverage (PRD §6.1 SRCH-5, §7.1, §7.3,
 * §13's M3 row), run against the same placeholder-Firebase,
 * no-live-Postgres, no-Meilisearch webServer m1.smoke.spec.ts and
 * m2.smoke.spec.ts already run against (see playwright.config.ts's own
 * doc comment) — no local stack required, safe for every CI run.
 *
 * Three things this file proves for real, in CI, on every push:
 *
 *  1. `/for-sale?view=map` never crashes, with or without working map
 *     tiles. This environment has no live search index (same
 *     search_unavailable outage m2.smoke.spec.ts already documents for
 *     the list route), so the map pane is deterministically pin-less —
 *     the interesting, actually-CI-safe assertion here is the *shell*:
 *     heading/breadcrumb/toggle survive, the map canvas mounts, and the
 *     outage copy renders in place of pins rather than taking the page
 *     down. Tiles themselves come from a real OpenFreeMap network call
 *     this suite deliberately does not depend on being reachable from a
 *     CI runner (reachable today; not asserted) — the tiles-failed
 *     fallback (§1.8 point 3) is accepted as an equally-passing outcome
 *     alongside a loaded canvas, never a crash.
 *  2. The `[Map]`/`[List]` toggle actually switches views end to end
 *     (URL + rendered surface), not just that each renders in isolation.
 *  3. Axe: zero violations on the map view shell, desktop and mobile.
 *     What this environment *cannot* exercise: the aria-hidden
 *     individual-pin/cluster markup (pin-marker.ts/cluster-marker.ts,
 *     §4) — those only ever mount once real hits exist, and this
 *     environment's whole point is having no live search index to
 *     produce any. That half of the "aria-hidden pin strategy has zero
 *     violations" claim is instead proven in
 *     m3.parity.spec.ts (RUN_LOCAL_STACK_E2E=1), which axe-scans the map
 *     view against real, seeded pins.
 *
 * Feature-flag-off coverage (`NEXT_PUBLIC_FEATURE_MAP=false` hides the
 * toggle): **not** re-proven here. `NEXT_PUBLIC_FEATURE_MAP` is inlined
 * by Next.js at *build* time (lib/feature-flags.ts), and this suite's
 * single webServer already builds once with the flag at its default
 * (enabled) — a second, flag-off e2e run would mean a second full
 * `next build` in CI (this job already builds the app once itself, on
 * top of the separate `build` job — see playwright.config.ts's and
 * ci.yml's own doc comments on that existing duplication) to
 * re-demonstrate a boolean that
 * tests/unit/components/features/search/results-view.test.tsx already
 * asserts precisely (`'hides the toggle entirely when the feature flag
 * is off (kill switch)'`, plus the `view=map`-in-URL-is-ignored case
 * alongside it) via `vi.stubEnv`. Doubling this job's build cost to
 * re-prove an already-exhaustively-unit-tested env-var branch was
 * judged not worth it — noted here rather than silently skipped.
 */

import AxeBuilder from '@axe-core/playwright'
import { expect, test } from '@playwright/test'

const WCAG_TAGS = ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa']

test.describe('map view shell — no live search index (PRD §7.6 applied to the map surface)', () => {
  test('/for-sale?view=map renders the shell and the map pane gracefully, whether or not tiles load', async ({
    page,
  }) => {
    const response = await page.goto('/for-sale?view=map')
    expect(response?.status()).toBe(200)

    // The desktop toggle row (§2) is not hidden in map view on desktop —
    // only mobile's map view hides it — so the full header, including
    // the now-"List"-labelled toggle, is expected to be present here
    // (this suite's default project is a desktop viewport).
    await expect(
      page.getByRole('heading', {
        level: 1,
        name: 'Homes for sale in Reading & the Thames Valley',
      }),
    ).toBeVisible()
    await expect(
      page.getByRole('navigation', { name: 'Breadcrumb' }),
    ).toContainText('Home / For sale')
    await expect(page.getByRole('button', { name: 'List' })).toBeVisible()

    await expect(page.getByTestId('map-view')).toBeVisible()

    // Pin-less by construction here (no live search index to source hits
    // from) — the desktop list column shows the same OutagePanel copy
    // the plain list route shows (m2.smoke.spec.ts), proven precisely
    // rather than just "didn't crash."
    await expect(
      page.getByRole('heading', {
        level: 2,
        name: /Search.s taking a breather\./,
      }),
    ).toBeVisible()

    // The map pane itself: either a real canvas mounted (tiles loading
    // or not — MapLibre creates the canvas synchronously on init
    // regardless of tile network success) or, if the map library/tile
    // CDN failed outright, §1.8 point 3's own fallback card. Accepting
    // either as a pass is the point — this suite does not depend on
    // OpenFreeMap being reachable from CI to stay green.
    const canvas = page.locator('.map-canvas-container canvas')
    const tilesFailedHeading = page.getByRole('heading', {
      level: 2,
      name: 'Map tiles aren’t loading right now.',
    })
    await expect(canvas.or(tilesFailedHeading)).toBeVisible({
      timeout: 15_000,
    })
  })

  test('/for-sale?view=map on a mobile viewport renders the full-screen map surface without crashing', async ({
    page,
  }) => {
    await page.setViewportSize({ width: 375, height: 812 })
    const response = await page.goto('/for-sale?view=map')
    expect(response?.status()).toBe(200)

    // `.toBeAttached()`, not `.toBeVisible()`: the map view's own root
    // is a flex container whose real, on-screen content is all
    // `position: fixed` (map-view.tsx's mobile pane) — removed from
    // normal flow, so the flex root's own box collapses to zero height
    // on a narrow viewport even though its fixed children genuinely
    // cover the screen. Presence, not the root's own box, is the
    // meaningful check here; the assertions below check real visible
    // content instead.
    await expect(page.getByTestId('map-view')).toBeAttached()

    // Mobile has no list column — the same outage copy renders as an
    // overlay card on top of the map instead (§1.8).
    await expect(
      page.getByRole('heading', {
        level: 2,
        name: /Search.s taking a breather\./,
      }),
    ).toBeVisible()

    const canvas = page.locator('.map-canvas-container canvas')
    const tilesFailedHeading = page.getByRole('heading', {
      level: 2,
      name: 'Map tiles aren’t loading right now.',
    })
    await expect(canvas.or(tilesFailedHeading)).toBeVisible({
      timeout: 15_000,
    })
  })
})

test.describe('the [Map]/[List] toggle', () => {
  test('switches from list to map and back, updating both the URL and the rendered surface', async ({
    page,
  }) => {
    await page.goto('/for-sale')
    await expect(
      page.getByRole('heading', {
        level: 1,
        name: 'Homes for sale in Reading & the Thames Valley',
      }),
    ).toBeVisible()
    await expect(page.getByTestId('map-view')).toHaveCount(0)

    await page.getByRole('button', { name: 'Map' }).click()
    await expect(page).toHaveURL(/[?&]view=map\b/)
    await expect(page.getByTestId('map-view')).toBeVisible()

    await page.getByRole('button', { name: 'List' }).click()
    await expect(page).not.toHaveURL(/[?&]view=map\b/)
    await expect(page.getByTestId('map-view')).toHaveCount(0)
  })
})

test.describe('accessibility — map view shell (M3)', () => {
  test('map view (desktop) has no automatically detectable WCAG 2.2 AA violations', async ({
    page,
  }) => {
    await page.emulateMedia({ reducedMotion: 'reduce' })
    await page.goto('/for-sale?view=map')
    await expect(page.getByTestId('map-view')).toBeVisible()

    const results = await new AxeBuilder({ page }).withTags(WCAG_TAGS).analyze()
    expect(results.violations).toEqual([])
  })

  test('map view (mobile) has no automatically detectable WCAG 2.2 AA violations', async ({
    page,
  }) => {
    await page.setViewportSize({ width: 375, height: 812 })
    await page.emulateMedia({ reducedMotion: 'reduce' })
    await page.goto('/for-sale?view=map')
    // Waits on real visible content, not the map view's own root — see
    // the `.toBeAttached()` doc comment above for why that root's box
    // collapses to zero height on a narrow viewport regardless.
    await expect(
      page.getByRole('heading', {
        level: 2,
        name: /Search.s taking a breather\./,
      }),
    ).toBeVisible()

    const results = await new AxeBuilder({ page }).withTags(WCAG_TAGS).analyze()
    expect(results.violations).toEqual([])
  })
})
