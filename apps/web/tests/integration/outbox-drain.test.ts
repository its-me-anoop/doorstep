import { randomUUID } from 'node:crypto'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

import { drizzle } from 'drizzle-orm/postgres-js'
import { migrate } from 'drizzle-orm/postgres-js/migrator'
import { Meilisearch } from 'meilisearch'
import postgres from 'postgres'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'

import {
  MeilisearchSearchIndex,
  resolveMeilisearchIndexName,
} from '@/adapters/meilisearch'
import { DrizzleAgencyRepository } from '@/adapters/drizzle/repositories/agency-repository'
import { DrizzleListingRepository } from '@/adapters/drizzle/repositories/listing-repository'
import { DrizzleOutboxRepository } from '@/adapters/drizzle/repositories/outbox-repository'
import { DrizzlePropertyImageRepository } from '@/adapters/drizzle/repositories/property-image-repository'
import { DrizzleUserRepository } from '@/adapters/drizzle/repositories/user-repository'
import * as schema from '@/adapters/drizzle/schema'
import { outbox } from '@/adapters/drizzle/schema'
import type { NewListingDraft } from '@/ports/listing-repository'
import type { User } from '@/ports/user-repository'
import { DrainOutbox } from '@/services/search-sync'

import { InMemoryImageStorage } from '../support/in-memory-image-storage'

// End-to-end proof of PRD §8.6's exit criterion, "publish-to-searchable
// under 1 minute": a real transitionWithOutbox publish (the exact write
// path a real approval takes — same transactional outbox row a live
// ChangeListingStatus/admin-approval write would produce, PRD §9.3),
// drained for real by DrainOutbox against a real Postgres instance and a
// real Meilisearch daemon. Skipped unless both TEST_DATABASE_URL and
// TEST_MEILISEARCH_HOST/TEST_MEILISEARCH_API_KEY are set — same
// conditions as tests/integration/listing-repository.test.ts and
// tests/integration/meilisearch-adapter.test.ts individually; this file
// needs both live dependencies at once. Run locally with:
//   TEST_DATABASE_URL=postgres://anoopjose@localhost:5432/doorstep_test \
//   TEST_MEILISEARCH_HOST=http://127.0.0.1:7700 \
//   TEST_MEILISEARCH_API_KEY=local-dev-master-key \
//   pnpm test:integration
const TEST_DATABASE_URL = process.env.TEST_DATABASE_URL
const TEST_MEILISEARCH_HOST = process.env.TEST_MEILISEARCH_HOST
const TEST_MEILISEARCH_API_KEY = process.env.TEST_MEILISEARCH_API_KEY

const dirname = path.dirname(fileURLToPath(import.meta.url))
const migrationsFolder = path.resolve(
  dirname,
  '../../src/adapters/drizzle/migrations',
)

describe.skipIf(!TEST_DATABASE_URL || !TEST_MEILISEARCH_HOST)(
  'DrainOutbox end-to-end (live Postgres + live Meilisearch)',
  () => {
    let client: ReturnType<typeof postgres>
    let db: ReturnType<typeof drizzle<typeof schema>>
    let listingRepository: DrizzleListingRepository
    let outboxRepository: DrizzleOutboxRepository
    // A per-run, disposable index (same technique as
    // tests/integration/meilisearch-adapter.test.ts) — this suite's writes
    // can never collide with a real dev/CI index or another concurrent run.
    const runPrefix = `doorstep-test-${Date.now()}-${randomUUID().slice(0, 8)}`
    const searchEnv = {
      ...process.env,
      MEILISEARCH_HOST: TEST_MEILISEARCH_HOST,
      MEILISEARCH_API_KEY: TEST_MEILISEARCH_API_KEY,
      MEILISEARCH_INDEX_PREFIX: runPrefix,
    }
    const searchIndex = new MeilisearchSearchIndex(searchEnv)
    let rawMeiliClient: Meilisearch
    let imageStorage: InMemoryImageStorage
    let drainOutbox: DrainOutbox
    let lister: User

    beforeAll(async () => {
      client = postgres(TEST_DATABASE_URL as string, { max: 1 })
      db = drizzle(client, { schema })
      await migrate(db, { migrationsFolder })

      // This suite's DrainOutbox drains the WHOLE outbox table (it has no
      // per-suite scope, by design — see ports/outbox-repository.ts), and
      // this database persists across local test runs (no Docker/CI
      // teardown) — same "clean the shared table first" fix
      // tests/integration/outbox-repository.test.ts's own beforeEach
      // applies, needed here so `countPending()` assertions below aren't
      // polluted by another suite's leftover rows.
      await db.delete(outbox)

      rawMeiliClient = new Meilisearch({
        host: TEST_MEILISEARCH_HOST as string,
        apiKey: TEST_MEILISEARCH_API_KEY,
      })

      listingRepository = new DrizzleListingRepository(db)
      outboxRepository = new DrizzleOutboxRepository(db)
      imageStorage = new InMemoryImageStorage()
      drainOutbox = new DrainOutbox(
        outboxRepository,
        listingRepository,
        new DrizzlePropertyImageRepository(db),
        new DrizzleAgencyRepository(db),
        imageStorage,
        searchIndex,
      )

      await searchIndex.ensureSettings()

      lister = await new DrizzleUserRepository(db).create({
        firebaseUid: `firebase-${crypto.randomUUID()}`,
        email: `lister-${crypto.randomUUID()}@example.co.uk`,
        displayName: 'Test Lister',
        role: 'owner',
        agencyId: null,
        status: 'active',
      })
    }, 30_000)

    afterAll(async () => {
      await imageStorage.close()
      await rawMeiliClient
        .deleteIndex(resolveMeilisearchIndexName(searchEnv))
        .waitTask()
      await client.end()
    })

    function draft(overrides: Partial<NewListingDraft> = {}): NewListingDraft {
      return {
        listerId: lister.id,
        agencyId: null,
        channel: 'sale',
        propertyType: 'detached',
        title: 'Outbox drain end-to-end fixture',
        slug: `outbox-drain-e2e-${crypto.randomUUID()}`,
        description: 'A lovely test house, published for real.',
        features: [],
        bedrooms: 4,
        bathrooms: 2,
        price: 475_000,
        priceQualifier: 'guide_price',
        tenure: 'freehold',
        deposit: null,
        furnished: null,
        availableFrom: null,
        epcRating: null,
        councilTaxBand: 'E',
        newHome: false,
        addressLine1: '1 Outbox Drain Close',
        displayAddress: 'Outbox Drain Close, Reading, RG30',
        town: 'Reading',
        outcode: 'RG30',
        postcode: 'RG30 1AA',
        location: { lat: 51.4543, lng: -0.9781 },
        locationApproximate: false,
        ...overrides,
      }
    }

    it('drains a freshly published listing into Meilisearch well under the 1-minute exit criterion', async () => {
      const created = await listingRepository.createDraft(draft())
      const now = new Date()

      // The exact write path a real publish takes: one transaction, one
      // properties UPDATE, one outbox upsert row (PRD §8.6/§9.3) — not a
      // raw insert into `outbox`. "publish-to-searchable" starts the
      // instant this commits.
      const published = await listingRepository.transitionWithOutbox(
        created.id,
        'published',
        { statusChangedAt: now, publishedAt: now, outboxOp: 'upsert' },
      )
      const publishedAtMs = Date.now()

      const result = await drainOutbox.execute()

      // MeilisearchSearchIndex.upsert awaits the write task before
      // resolving (see that adapter's header comment), so the document is
      // already searchable the instant execute() above returns — no
      // polling loop needed to get an honest measurement.
      const searchableAtMs = Date.now()
      const elapsedMs = searchableAtMs - publishedAtMs

      // Deliberate console.log, not debug noise left behind: this is the
      // measurement this test exists to produce (PRD §8.6/§13's
      // "publish-to-searchable under 1 minute" exit criterion).
      console.log(`[outbox-drain e2e] publish-to-searchable: ${elapsedMs}ms`)
      expect(elapsedMs).toBeLessThan(60_000)

      expect(result.upserts).toBeGreaterThanOrEqual(1)

      const found = await searchIndex.search({
        channel: 'sale',
        filters: { town: 'Reading' },
        page: 1,
        hitsPerPage: 50,
      })
      const hit = found.hits.find((h) => h.id === published.id)
      expect(hit).toBeDefined()
      expect(hit?.title).toBe('Outbox drain end-to-end fixture')

      expect(await outboxRepository.countPending()).toBe(0)
    }, 30_000)

    it('drains an outbox delete row and removes the document from Meilisearch', async () => {
      const created = await listingRepository.createDraft(draft())
      const now = new Date()
      const published = await listingRepository.transitionWithOutbox(
        created.id,
        'published',
        { statusChangedAt: now, publishedAt: now, outboxOp: 'upsert' },
      )
      await drainOutbox.execute()
      const beforeDelete = await searchIndex.search({
        channel: 'sale',
        filters: { town: 'Reading' },
        page: 1,
        hitsPerPage: 50,
      })
      expect(beforeDelete.hits.some((h) => h.id === published.id)).toBe(true)

      // Repo-level, per this task's brief: a raw outbox delete row rather
      // than a full ChangeListingStatus service call — the drain worker
      // only ever sees outbox rows, not how they got there.
      await db.insert(outbox).values({ propertyId: published.id, op: 'delete' })

      const result = await drainOutbox.execute()

      expect(result.deletes).toBeGreaterThanOrEqual(1)
      const afterDelete = await searchIndex.search({
        channel: 'sale',
        filters: { town: 'Reading' },
        page: 1,
        hitsPerPage: 50,
      })
      expect(afterDelete.hits.some((h) => h.id === published.id)).toBe(false)
    }, 30_000)
  },
)
