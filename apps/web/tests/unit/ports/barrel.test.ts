import { beforeAll, describe, expect, it } from 'vitest'

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

  describe('createServices()', () => {
    // getDb() (adapters/drizzle/client.ts) reads DATABASE_URL the first
    // time it's called, which createServices() does eagerly. There is no
    // live database in this environment (per PRD, no local Postgres or
    // Firebase project), but getDb() itself never opens a connection —
    // the underlying `postgres` client is lazy — so a syntactically
    // valid placeholder is enough to prove createServices() wires
    // everything up without touching the network. Firebase env vars are
    // never read here because FirebaseAuthGateway only calls
    // getAdminApp() from inside a method, not its constructor.
    beforeAll(() => {
      process.env.DATABASE_URL ??=
        'postgres://user:password@localhost:5432/doorstep'
    })

    it('wires the auth service group', () => {
      const services = createServices()

      expect(services.auth.establishSession).toBeDefined()
      expect(services.auth.terminateSession).toBeDefined()
      expect(services.auth.getCurrentUser).toBeDefined()
    })
  })
})
