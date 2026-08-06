import { NextRequest } from 'next/server'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { PublicListingNotFoundError } from '@/services/listings/errors'

const getPublicListing = { execute: vi.fn() }

vi.mock('@/lib/composition', () => ({
  createServices: () => ({
    listings: { getPublicListing },
  }),
}))

function getRequest(slug: string): NextRequest {
  return new NextRequest(`https://doorstep.test/api/v1/properties/${slug}`)
}

function context(slug: string) {
  return { params: Promise.resolve({ slug }) }
}

// GET /api/v1/properties/{slug} — public, no session (PRD §10). Thin per
// PRD §8.5: parse the path param, call the service, map the result.
describe('GET /api/v1/properties/[slug]', () => {
  beforeEach(() => {
    getPublicListing.execute.mockReset()
  })

  it('calls the service with the slug and returns { data: { listing } }', async () => {
    const listing = { id: 'listing-1', slug: 'a-slug' }
    getPublicListing.execute.mockResolvedValue(listing)
    const { GET } = await import('@/app/api/v1/properties/[slug]/route')

    const response = await GET(getRequest('a-slug'), context('a-slug'))

    expect(getPublicListing.execute).toHaveBeenCalledWith('a-slug')
    expect(response.status).toBe(200)
    const body = await response.json()
    expect(body.data.listing).toEqual(listing)
  })

  it('maps PublicListingNotFoundError to 404 not_found', async () => {
    getPublicListing.execute.mockRejectedValue(
      new PublicListingNotFoundError('missing-slug'),
    )
    const { GET } = await import('@/app/api/v1/properties/[slug]/route')

    const response = await GET(
      getRequest('missing-slug'),
      context('missing-slug'),
    )

    expect(response.status).toBe(404)
    const body = await response.json()
    expect(body.error.code).toBe('not_found')
  })

  it('maps an unexpected service error to 500', async () => {
    const consoleError = vi
      .spyOn(console, 'error')
      .mockImplementation(() => undefined)
    getPublicListing.execute.mockRejectedValue(new Error('boom'))
    const { GET } = await import('@/app/api/v1/properties/[slug]/route')

    const response = await GET(getRequest('a-slug'), context('a-slug'))

    expect(response.status).toBe(500)
    consoleError.mockRestore()
  })
})
