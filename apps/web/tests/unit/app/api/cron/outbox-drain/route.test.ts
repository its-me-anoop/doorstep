import { NextRequest } from 'next/server'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const drainOutbox = { execute: vi.fn() }
const isAuthorizedCronRequest = vi.fn()

vi.mock('@/lib/composition', () => ({
  createServices: () => ({
    search: { drainOutbox },
  }),
}))

vi.mock('@/lib/verify-cron-request', () => ({
  isAuthorizedCronRequest: (...args: unknown[]) =>
    isAuthorizedCronRequest(...args),
}))

function getRequest(headers: Record<string, string> = {}): NextRequest {
  return new NextRequest('https://doorstep.test/api/cron/outbox-drain', {
    headers,
  })
}

// GET /api/cron/outbox-drain — Vercel Cron always triggers via a GET
// request (see src/lib/verify-cron-request.ts's doc comment and this
// route's own header comment for why this deviates from a POST handler),
// authorized via isAuthorizedCronRequest (src/lib/verify-cron-request.ts,
// tested on its own there) rather than a session cookie.
describe('GET /api/cron/outbox-drain', () => {
  beforeEach(() => {
    drainOutbox.execute.mockReset()
    isAuthorizedCronRequest.mockReset()
  })

  it('401s without calling the service when unauthorized', async () => {
    isAuthorizedCronRequest.mockReturnValue(false)
    const { GET } = await import('@/app/api/cron/outbox-drain/route')

    const response = await GET(getRequest())

    expect(response.status).toBe(401)
    const body = await response.json()
    expect(body.error.code).toBe('unauthorized')
    expect(drainOutbox.execute).not.toHaveBeenCalled()
  })

  it('runs the drain and returns its result on success', async () => {
    isAuthorizedCronRequest.mockReturnValue(true)
    const result = {
      processed: 5,
      upserts: 3,
      deletes: 2,
      pendingRemaining: 0,
    }
    drainOutbox.execute.mockResolvedValue(result)
    const { GET } = await import('@/app/api/cron/outbox-drain/route')

    const response = await GET(getRequest({ authorization: 'Bearer secret' }))

    expect(drainOutbox.execute).toHaveBeenCalledOnce()
    expect(response.status).toBe(200)
    const body = await response.json()
    expect(body.data).toEqual(result)
  })

  it('maps an unexpected service error to 500', async () => {
    const consoleError = vi
      .spyOn(console, 'error')
      .mockImplementation(() => undefined)
    isAuthorizedCronRequest.mockReturnValue(true)
    drainOutbox.execute.mockRejectedValue(new Error('Meilisearch is down'))
    const { GET } = await import('@/app/api/cron/outbox-drain/route')

    const response = await GET(getRequest({ authorization: 'Bearer secret' }))

    expect(response.status).toBe(500)
    consoleError.mockRestore()
  })
})
