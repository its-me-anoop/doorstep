import { afterEach, describe, expect, it, vi } from 'vitest'

import {
  changeListingStatus,
  createDraftListing,
  deleteListing,
  geocodeSearch,
  listMyListings,
  ListingsApiError,
  patchListing,
  submitListing,
} from '@/lib/listings-client'

function jsonResponse(body: unknown, status = 200): Response {
  return {
    ok: status >= 200 && status < 300,
    status,
    json: () => Promise.resolve(body),
  } as Response
}

describe('lib/listings-client', () => {
  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('createDraftListing POSTs the input to /api/v1/listings and returns the created listing', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValue(
        jsonResponse({ data: { listing: { id: 'listing-1' } } }, 201),
      )
    vi.stubGlobal('fetch', fetchMock)

    const listing = await createDraftListing({
      channel: 'sale',
      propertyType: 'flat',
    })

    expect(fetchMock).toHaveBeenCalledWith('/api/v1/listings', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ channel: 'sale', propertyType: 'flat' }),
    })
    expect(listing).toEqual({ id: 'listing-1' })
  })

  it('patchListing PATCHes /api/v1/listings/{id} and returns the updated listing', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValue(
        jsonResponse({ data: { listing: { id: 'listing-1', price: 250000 } } }),
      )
    vi.stubGlobal('fetch', fetchMock)

    const listing = await patchListing('listing-1', { price: 250_000 })

    expect(fetchMock).toHaveBeenCalledWith('/api/v1/listings/listing-1', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ price: 250_000 }),
    })
    expect(listing).toEqual({ id: 'listing-1', price: 250000 })
  })

  it('submitListing POSTs /api/v1/listings/{id}/submit with no body', async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      jsonResponse({
        data: { listing: { id: 'listing-1', status: 'pending_review' } },
      }),
    )
    vi.stubGlobal('fetch', fetchMock)

    const listing = await submitListing('listing-1')

    expect(fetchMock).toHaveBeenCalledWith(
      '/api/v1/listings/listing-1/submit',
      {
        method: 'POST',
      },
    )
    expect(listing.status).toBe('pending_review')
  })

  it('changeListingStatus POSTs /api/v1/listings/{id}/status with the action', async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      jsonResponse({
        data: { listing: { id: 'listing-1', status: 'hidden' } },
      }),
    )
    vi.stubGlobal('fetch', fetchMock)

    const listing = await changeListingStatus('listing-1', 'hide')

    expect(fetchMock).toHaveBeenCalledWith(
      '/api/v1/listings/listing-1/status',
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'hide' }),
      },
    )
    expect(listing.status).toBe('hidden')
  })

  it('deleteListing DELETEs /api/v1/listings/{id} with no body', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValue(jsonResponse({ data: { deleted: true } }))
    vi.stubGlobal('fetch', fetchMock)

    await deleteListing('listing-1')

    expect(fetchMock).toHaveBeenCalledWith('/api/v1/listings/listing-1', {
      method: 'DELETE',
    })
  })

  it('listMyListings GETs /api/v1/listings with no query params by default', async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      jsonResponse({
        data: [{ id: 'listing-1' }],
        nextCursor: 'listing-1',
      }),
    )
    vi.stubGlobal('fetch', fetchMock)

    const page = await listMyListings()

    expect(fetchMock).toHaveBeenCalledWith('/api/v1/listings', undefined)
    expect(page).toEqual({
      data: [{ id: 'listing-1' }],
      nextCursor: 'listing-1',
    })
  })

  it('listMyListings GETs /api/v1/listings?cursor=&limit= when supplied', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValue(jsonResponse({ data: [], nextCursor: null }))
    vi.stubGlobal('fetch', fetchMock)

    await listMyListings({ cursor: 'listing-9', limit: 10 })

    expect(fetchMock).toHaveBeenCalledWith(
      '/api/v1/listings?cursor=listing-9&limit=10',
      undefined,
    )
  })

  it('geocodeSearch GETs /api/v1/geocode?q= and returns the results array', async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      jsonResponse({
        data: {
          results: [
            { lat: 51.45, lng: -0.97, label: 'Reading', outcode: 'RG30' },
          ],
        },
      }),
    )
    vi.stubGlobal('fetch', fetchMock)

    const results = await geocodeSearch('RG30 1AA')

    expect(fetchMock).toHaveBeenCalledWith(
      `/api/v1/geocode?q=${encodeURIComponent('RG30 1AA')}`,
      undefined,
    )
    expect(results).toEqual([
      { lat: 51.45, lng: -0.97, label: 'Reading', outcode: 'RG30' },
    ])
  })

  it('throws a ListingsApiError carrying the server-supplied message on a non-OK response', async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      jsonResponse(
        {
          error: {
            code: 'invalid_request',
            message: 'Enter address line 1.',
          },
        },
        400,
      ),
    )
    vi.stubGlobal('fetch', fetchMock)

    await expect(patchListing('listing-1', {})).rejects.toMatchObject({
      code: 'invalid_request',
      message: 'Enter address line 1.',
    })
    await expect(patchListing('listing-1', {})).rejects.toBeInstanceOf(
      ListingsApiError,
    )
  })

  it('falls back to a generic message when the error envelope has none', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValue(
        jsonResponse({ error: { code: 'internal_error' } }, 500),
      )
    vi.stubGlobal('fetch', fetchMock)

    await expect(submitListing('listing-1')).rejects.toMatchObject({
      code: 'internal_error',
      message: 'Something went wrong on our end — try again in a moment.',
    })
  })
})
