import { inspect } from 'node:util'

import { beforeEach, describe, expect, it, vi } from 'vitest'

const redirectMock = vi.fn((path: string) => {
  throw new Error(`REDIRECT:${path}`)
})
vi.mock('next/navigation', () => ({
  redirect: (path: string) => redirectMock(path),
}))

const searchListingsExecute = vi.fn()
const listNewestInAreaExecute = vi.fn()
vi.mock('@/lib/composition', () => ({
  createServices: () => ({
    search: { searchListings: { execute: searchListingsExecute } },
    listings: { listNewestInArea: { execute: listNewestInAreaExecute } },
  }),
}))

function serialise(node: unknown): string {
  return inspect(node, { depth: 20, breakLength: Infinity })
}

function baseSearchResult(totalCount = 12) {
  return {
    results: [],
    totalCount,
    page: 1,
    totalPages: 1,
    facets: { propertyType: {} },
  }
}

const readingArea = {
  slug: 'reading',
  label: 'Reading',
  match: { town: 'Reading' },
  centre: { lat: 51.4543, lng: -0.9781 },
  radiusMiles: 3,
  intro: "Reading's town centre puts everything within a short walk.",
}

// M2-DESIGN-SPEC.md §4 — the area landing page is the results page for
// that area with zero additional filters, plus the intro/newest-strip
// section injected between the header and the filter bar.
describe('SearchResultsPage (area tier)', () => {
  beforeEach(() => {
    searchListingsExecute.mockReset()
    listNewestInAreaExecute.mockReset()
    redirectMock.mockClear()
    searchListingsExecute.mockResolvedValue(baseSearchResult())
    listNewestInAreaExecute.mockResolvedValue([])
  })

  it('scopes the SSR search to the area town/outcode filter', async () => {
    const { SearchResultsPage } =
      await import('@/components/features/search/search-results-page')

    await SearchResultsPage({
      channel: 'sale',
      tier: 'area',
      rawSearchParams: {},
      area: readingArea,
    })

    expect(searchListingsExecute).toHaveBeenCalledWith(
      expect.objectContaining({ town: 'Reading' }),
    )
  })

  it('fetches the newest-in-area strip and renders AreaIntro when no filters are active', async () => {
    listNewestInAreaExecute.mockResolvedValue([{ id: 'pr_1' }])
    const { SearchResultsPage } =
      await import('@/components/features/search/search-results-page')

    const result = await SearchResultsPage({
      channel: 'sale',
      tier: 'area',
      rawSearchParams: {},
      area: readingArea,
    })

    expect(listNewestInAreaExecute).toHaveBeenCalledWith('sale', {
      town: 'Reading',
    })
    expect(serialise(result)).toContain('[Function: AreaIntro]')
  })

  it('does not fetch the newest-in-area strip when a filter is active', async () => {
    const { SearchResultsPage } =
      await import('@/components/features/search/search-results-page')

    const result = await SearchResultsPage({
      channel: 'sale',
      tier: 'area',
      rawSearchParams: { minBeds: '2' },
      area: readingArea,
    })

    expect(listNewestInAreaExecute).not.toHaveBeenCalled()
    expect(serialise(result)).not.toContain('[Function: AreaIntro]')
  })

  it('builds a three-crumb breadcrumb ending in the area label', async () => {
    const { SearchResultsPage } =
      await import('@/components/features/search/search-results-page')

    const result = await SearchResultsPage({
      channel: 'sale',
      tier: 'area',
      rawSearchParams: {},
      area: readingArea,
    })

    const serialised = serialise(result)
    expect(serialised).toContain("{ label: 'For sale', href: '/for-sale' }")
    expect(serialised).toContain("{ label: 'Reading' }")
  })

  it('uses /for-sale/{slug} as the base path (channel toggle target)', async () => {
    const { SearchResultsPage } =
      await import('@/components/features/search/search-results-page')

    const result = await SearchResultsPage({
      channel: 'sale',
      tier: 'area',
      rawSearchParams: {},
      area: readingArea,
    })

    expect(serialise(result)).toContain("basePath: '/for-sale/reading'")
  })

  // PRD §7.6 / M2-DESIGN-SPEC.md §1.10 point 4's own text ("area landing
  // pages don't fully degrade... independent of Meilisearch") is written
  // assuming Postgres itself stays up — it never says what happens if the
  // *newest-strip's own* Postgres read fails. Confirmed via a real e2e
  // run against a DB-unreachable placeholder environment
  // (tests/e2e/m2.smoke.spec.ts): before this test, that read's rejection
  // propagated uncaught out of this server component and 500'd the whole
  // area page — worse than the Meilisearch-outage case this same page
  // already degrades gracefully from. The newest strip is decoration
  // (AreaIntro already renders nothing for it when `newest` is empty,
  // exactly the M1/pre-launch shape every curated area with no matching
  // listings yet already produces), so a failed read degrades to that
  // same "no strip" shape rather than taking the page down.
  it('falls back to an empty newest strip rather than throwing when listNewestInArea fails', async () => {
    listNewestInAreaExecute.mockRejectedValue(
      new Error('connect ECONNREFUSED 127.0.0.1:5432'),
    )
    const { SearchResultsPage } =
      await import('@/components/features/search/search-results-page')

    const result = await SearchResultsPage({
      channel: 'sale',
      tier: 'area',
      rawSearchParams: {},
      area: readingArea,
    })

    // The results grid itself (Meilisearch-backed, mocked healthy here)
    // still renders normally — only the Postgres-backed strip degrades.
    expect(listNewestInAreaExecute).toHaveBeenCalled()
    expect(serialise(result)).toContain('[Function: AreaIntro]')
    expect(serialise(result)).toContain('newest: []')
  })
})
