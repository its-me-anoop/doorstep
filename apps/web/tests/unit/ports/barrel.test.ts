import { describe, expect, it } from 'vitest'

// Cheap regression net: these are type-only exports, so this test can't
// check values — it checks that the barrel module resolves and that a
// runtime value from lib/composition (which depends on the same port
// types) is shaped the way callers expect. A future agent adding
// concrete adapters can extend this into an ISP contract-test suite.
import { createServices } from '@/lib/composition'

describe('ports barrel', () => {
  it('resolves without throwing', async () => {
    await expect(import('@/ports')).resolves.toBeDefined()
  })

  it('createServices() returns an object services can be read from', () => {
    expect(createServices()).toEqual({})
  })
})
