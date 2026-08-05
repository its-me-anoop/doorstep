/**
 * m1.smoke.spec.ts — CI-safe M1 coverage (PRD §6.5 LST-1/LST-2, §7.3,
 * §8.8's e2e list) that never needs a real Firebase project: the
 * signed-out gate proxy.ts/decide-gate.ts puts in front of every M1
 * surface, and the landing page's one new M1 entry point (the
 * for-agents-section.tsx "List with Doorstep" CTA). Everything that
 * needs a real, onboarded account lives in m1.full-journey.spec.ts
 * instead, gated on real credentials exactly like full-auth.spec.ts.
 *
 * Mirrors smoke.auth.spec.ts's own scope line: placeholder Firebase envs
 * are enough to prove routing/gating and rendering, never enough to
 * complete a real sign-in — so nothing here signs in.
 */

import AxeBuilder from '@axe-core/playwright'
import { expect, test } from '@playwright/test'

const WCAG_TAGS = ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa']

test.describe('M1 signed-out gating (proxy.ts / decide-gate.ts)', () => {
  // /lister/listings/new matches the same session-only /lister prefix
  // rule as /lister itself (decide-gate.ts's ROUTE_RULES), so a
  // signed-out visit never even reaches NewListingRedirect's draft-create
  // call — it bounces at the proxy tier, same as a bare /lister visit.
  for (const path of ['/lister', '/lister/listings/new', '/onboarding']) {
    test(`redirects an unauthenticated request for ${path} to sign-in with an exact next param`, async ({
      page,
    }) => {
      await page.goto(path)
      await expect(page).toHaveURL(`/sign-in?next=${encodeURIComponent(path)}`)
    })
  }
})

test.describe('landing page for-agents CTA (M1-DESIGN-SPEC.md §2)', () => {
  test('"List with Doorstep" routes a signed-out visitor through /onboarding to sign-in', async ({
    page,
  }) => {
    await page.goto('/')

    // ForAgentsSection's CTA is a shadcn Button rendered onto a Next.js
    // Link via Base UI's `render` prop (button.tsx) — Base UI's
    // ButtonPrimitive still exposes role="button" on the resulting
    // anchor regardless of the swapped tag, so this is a button by role,
    // not a link, even though it navigates like one.
    await page.getByRole('button', { name: /List with Doorstep/ }).click()

    // for-agents-section.tsx's CTA points straight at /onboarding (no
    // /sign-up detour) — decide-gate.ts's session-only /onboarding rule
    // catches a signed-out click there and bounces to sign-in with an
    // exact next param, the same contract the gating tests above assert
    // directly.
    await expect(page).toHaveURL(
      `/sign-in?next=${encodeURIComponent('/onboarding')}`,
    )
  })
})

test.describe('accessibility — public surfaces (M1)', () => {
  // No new fully-public route ships in M1 (onboarding/lister/the wizard
  // are all gated; the dashboard and wizard's own axe coverage lives in
  // m1.full-journey.spec.ts, authenticated). The one new public content
  // is landing/for-agents-section.tsx's CTA block, added to the page
  // a11y.spec.ts already scans — re-scanning it here, self-contained to
  // this file, means M1's own axe coverage doesn't silently go stale if
  // a11y.spec.ts's PAGES list ever changes shape.
  test('landing page (including the M1 for-agents CTA) has no automatically detectable WCAG 2.2 AA violations', async ({
    page,
  }) => {
    // Same reduced-motion-before-first-navigation reasoning as
    // a11y.spec.ts: the hero's once-on-load entrance animation mid-fades
    // otherwise, producing a scan-timing contrast artefact rather than a
    // real defect.
    await page.emulateMedia({ reducedMotion: 'reduce' })
    await page.goto('/')

    const results = await new AxeBuilder({ page }).withTags(WCAG_TAGS).analyze()

    expect(results.violations).toEqual([])
  })
})
