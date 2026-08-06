import { NextRequest } from 'next/server'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const rebuildSearchIndex = { execute: vi.fn() }
const isAuthorizedCronRequest = vi.fn()

vi.mock('@/lib/composition', () => ({
  createServices: () => ({
    search: { rebuildSearchIndex },
  }),
}))

vi.mock('@/lib/verify-cron-request', () => ({
  isAuthorizedCronRequest: (...args: unknown[]) =>
    isAuthorizedCronRequest(...args),
}))

function getRequest(headers: Record<string, string> = {}): NextRequest {
  return new NextRequest('https://doorstep.test/api/cron/reindex', {
    headers,
  })
}

// GET /api/cron/reindex — same auth/shape as GET /api/cron/outbox-drain
// (see that route's own test file's header comment on GET vs. POST).
describe('GET /api/cron/reindex', () => {
  beforeEach(() => {
    rebuildSearchIndex.execute.mockReset()
    isAuthorizedCronRequest.mockReset()
  })

  it('401s without calling the service when unauthorized', async () => {
    isAuthorizedCronRequest.mockReturnValue(false)
    const { GET } = await import('@/app/api/cron/reindex/route')

    const response = await GET(getRequest())

    expect(response.status).toBe(401)
    const body = await response.json()
    expect(body.error.code).toBe('unauthorized')
    expect(rebuildSearchIndex.execute).not.toHaveBeenCalled()
  })

  it('runs the reindex and returns its result on success', async () => {
    isAuthorizedCronRequest.mockReturnValue(true)
    const result = {
      indexed: 5000,
      drift: {
        postgresCount: 5000,
        meiliCountBefore: 4998,
        meiliCountAfter: 5000,
      },
    }
    rebuildSearchIndex.execute.mockResolvedValue(result)
    const { GET } = await import('@/app/api/cron/reindex/route')

    const response = await GET(getRequest({ authorization: 'Bearer secret' }))

    expect(rebuildSearchIndex.execute).toHaveBeenCalledOnce()
    expect(response.status).toBe(200)
    const body = await response.json()
    expect(body.data).toEqual(result)
  })

  it('maps an unexpected service error to 500', async () => {
    const consoleError = vi
      .spyOn(console, 'error')
      .mockImplementation(() => undefined)
    isAuthorizedCronRequest.mockReturnValue(true)
    rebuildSearchIndex.execute.mockRejectedValue(
      new Error('Meilisearch is down'),
    )
    const { GET } = await import('@/app/api/cron/reindex/route')

    const response = await GET(getRequest({ authorization: 'Bearer secret' }))

    expect(response.status).toBe(500)
    consoleError.mockRestore()
  })
})
