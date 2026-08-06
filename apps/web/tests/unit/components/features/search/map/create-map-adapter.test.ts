import { afterEach, describe, expect, it, vi } from 'vitest'

const createMapLibreAdapterMock = vi.fn(() => ({ maplibre: true }))
const createMapboxAdapterMock = vi.fn((token: string) => ({
  mapbox: true,
  token,
}))

vi.mock('@/components/features/search/map/maplibre-adapter', () => ({
  createMapLibreAdapter: createMapLibreAdapterMock,
}))
vi.mock('@/components/features/search/map/mapbox-adapter', () => ({
  createMapboxAdapter: createMapboxAdapterMock,
}))

import {
  createMapAdapter,
  readMapboxAccessToken,
} from '@/components/features/search/map/create-map-adapter'

// M3-DESIGN-SPEC.md §0 / PRD §15 — the one place the provider decision
// is made. Both branches are dynamic imports (this module's own doc
// comment), so this test mocks the two provider modules rather than
// the underlying map libraries themselves.
describe('createMapAdapter', () => {
  afterEach(() => {
    vi.unstubAllEnvs()
    createMapLibreAdapterMock.mockClear()
    createMapboxAdapterMock.mockClear()
  })

  it('creates a MapLibre adapter when no Mapbox token is configured', async () => {
    vi.stubEnv('NEXT_PUBLIC_MAPBOX_ACCESS_TOKEN', undefined)
    const adapter = await createMapAdapter()
    expect(createMapLibreAdapterMock).toHaveBeenCalledTimes(1)
    expect(createMapboxAdapterMock).not.toHaveBeenCalled()
    expect(adapter).toEqual({ maplibre: true })
  })

  it('creates a Mapbox adapter, passing the token through, when configured', async () => {
    vi.stubEnv('NEXT_PUBLIC_MAPBOX_ACCESS_TOKEN', 'pk.test-token')
    const adapter = await createMapAdapter()
    expect(createMapboxAdapterMock).toHaveBeenCalledWith('pk.test-token')
    expect(createMapLibreAdapterMock).not.toHaveBeenCalled()
    expect(adapter).toEqual({ mapbox: true, token: 'pk.test-token' })
  })

  it('treats an empty string token the same as unset', async () => {
    vi.stubEnv('NEXT_PUBLIC_MAPBOX_ACCESS_TOKEN', '')
    await createMapAdapter()
    expect(createMapLibreAdapterMock).toHaveBeenCalledTimes(1)
  })
})

describe('readMapboxAccessToken', () => {
  afterEach(() => {
    vi.unstubAllEnvs()
  })

  it('returns undefined when unset or empty', () => {
    vi.stubEnv('NEXT_PUBLIC_MAPBOX_ACCESS_TOKEN', undefined)
    expect(readMapboxAccessToken()).toBeUndefined()
    vi.stubEnv('NEXT_PUBLIC_MAPBOX_ACCESS_TOKEN', '')
    expect(readMapboxAccessToken()).toBeUndefined()
  })

  it('returns the configured token', () => {
    vi.stubEnv('NEXT_PUBLIC_MAPBOX_ACCESS_TOKEN', 'pk.test-token')
    expect(readMapboxAccessToken()).toBe('pk.test-token')
  })
})
