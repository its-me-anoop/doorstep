import { beforeEach, describe, expect, it, vi } from 'vitest'

const listPublishedSlugs = { execute: vi.fn() }

vi.mock('@/lib/composition', () => ({
  createServices: () => ({
    listings: { listPublishedSlugs },
  }),
}))

describe('sitemap area slugs', () => {
  beforeEach(() => {
    listPublishedSlugs.execute.mockReset()
    listPublishedSlugs.execute.mockResolvedValue([])
  })

  it('emits /for-sale/liverpool and /to-rent/liverpool', async () => {
    const sitemap = (await import('@/app/sitemap')).default
    const entries = await sitemap()
    const urls = entries.map((entry) => entry.url)

    expect(urls).toContain('https://doorstep.local/for-sale/liverpool')
    expect(urls).toContain('https://doorstep.local/to-rent/liverpool')
  })
})
