import path from 'node:path'
import { fileURLToPath } from 'node:url'

import { drizzle } from 'drizzle-orm/postgres-js'
import { migrate } from 'drizzle-orm/postgres-js/migrator'
import postgres from 'postgres'
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest'

import { DrizzleAgencyRepository } from '@/adapters/drizzle/repositories/agency-repository'
import { DrizzleUserRepository } from '@/adapters/drizzle/repositories/user-repository'
import * as schema from '@/adapters/drizzle/schema'
import { AgencySlugConflictError } from '@/ports/agency-repository'
import type { User } from '@/ports/user-repository'

// Exercises DrizzleAgencyRepository's create/findBySlug/findById against a
// real Postgres+PostGIS instance, running the actual migrations in
// src/adapters/drizzle/migrations — same rationale and skip condition as
// tests/integration/db.schema.test.ts (no Docker/live database on this
// development machine; runs for real in CI's postgis service container,
// PRD §8.8). The `created_by` FK's *rejection* behaviour is already
// covered there via a raw insert; this file adds the same coverage
// through the repository class itself, proving create() doesn't
// mis-translate a foreign-key violation into an AgencySlugConflictError.
const TEST_DATABASE_URL = process.env.TEST_DATABASE_URL

const dirname = path.dirname(fileURLToPath(import.meta.url))
const migrationsFolder = path.resolve(
  dirname,
  '../../src/adapters/drizzle/migrations',
)

describe.skipIf(!TEST_DATABASE_URL)(
  'DrizzleAgencyRepository (live database)',
  () => {
    let client: ReturnType<typeof postgres>
    let db: ReturnType<typeof drizzle<typeof schema>>
    let agencyRepository: DrizzleAgencyRepository
    let owner: User

    beforeAll(async () => {
      client = postgres(TEST_DATABASE_URL as string, { max: 1 })
      db = drizzle(client, { schema })
      await migrate(db, { migrationsFolder })
      agencyRepository = new DrizzleAgencyRepository(db)
    })

    afterAll(async () => {
      await client.end()
    })

    beforeEach(async () => {
      // A fresh users row per test — agencies.created_by is NOT NULL FK, so
      // every agency insert needs a real owner to point at.
      owner = await new DrizzleUserRepository(db).create({
        firebaseUid: `firebase-${crypto.randomUUID()}`,
        email: `agent-${crypto.randomUUID()}@example.co.uk`,
        displayName: 'Test Agent',
        role: 'user',
        agencyId: null,
        status: 'active',
      })
    })

    it('creates an agency and reads it back by id and by slug', async () => {
      const slug = `test-agency-${crypto.randomUUID()}`

      const created = await agencyRepository.create({
        name: 'Test Agency',
        slug,
        logoPath: null,
        phone: '0118 950 1147',
        email: 'hello@test-agency.example.co.uk',
        website: 'https://test-agency.example.co.uk',
        address: '1 Test Street, Reading',
        verified: false,
        createdBy: owner.id,
      })

      expect(created.id).toBeTruthy()
      expect(created.slug).toBe(slug)
      expect(created.verified).toBe(false)
      expect(created.createdBy).toBe(owner.id)

      const byId = await agencyRepository.findById(created.id)
      expect(byId).toEqual(created)

      const bySlug = await agencyRepository.findBySlug(slug)
      expect(bySlug).toEqual(created)
    })

    it('returns null for an unknown id and an unknown slug', async () => {
      expect(await agencyRepository.findById(crypto.randomUUID())).toBeNull()
      expect(await agencyRepository.findBySlug('no-such-agency')).toBeNull()
    })

    it('translates a duplicate-slug insert into AgencySlugConflictError', async () => {
      const slug = `test-agency-${crypto.randomUUID()}`
      await agencyRepository.create({
        name: 'Test Agency',
        slug,
        logoPath: null,
        phone: '0118 950 1147',
        email: 'hello@test-agency.example.co.uk',
        website: 'https://test-agency.example.co.uk',
        address: '1 Test Street, Reading',
        verified: false,
        createdBy: owner.id,
      })

      await expect(
        agencyRepository.create({
          name: 'Test Agency Again',
          slug,
          logoPath: null,
          phone: '0118 950 1148',
          email: 'again@test-agency.example.co.uk',
          website: 'https://test-agency.example.co.uk',
          address: '2 Test Street, Reading',
          verified: false,
          createdBy: owner.id,
        }),
      ).rejects.toBeInstanceOf(AgencySlugConflictError)
    })

    it('rejects (and does not mis-map) an agency whose created_by does not reference an existing user', async () => {
      // Same FK asserted via a raw insert in db.schema.test.ts; asserted
      // here through the repository's own create() to prove its
      // unique-violation mapper (agencies_slug_idx only) doesn't swallow a
      // foreign-key violation (a different Postgres error code) as a slug
      // conflict.
      await expect(
        agencyRepository.create({
          name: 'Ghost Agency',
          slug: `ghost-agency-${crypto.randomUUID()}`,
          logoPath: null,
          phone: '01189000000',
          email: `ghost-${crypto.randomUUID()}@example.co.uk`,
          website: 'https://example.co.uk',
          address: '1 Nowhere Street, Reading',
          verified: false,
          createdBy: crypto.randomUUID(),
        }),
      ).rejects.not.toBeInstanceOf(AgencySlugConflictError)
    })

    it('rejects the row that lost a duplicate-slug insert, and the row that won it stays queryable', async () => {
      const slug = `test-agency-${crypto.randomUUID()}`
      const winner = await agencyRepository.create({
        name: 'Winner Agency',
        slug,
        logoPath: null,
        phone: '0118 950 1147',
        email: 'winner@test-agency.example.co.uk',
        website: 'https://test-agency.example.co.uk',
        address: '1 Test Street, Reading',
        verified: false,
        createdBy: owner.id,
      })

      await expect(
        agencyRepository.create({
          name: 'Loser Agency',
          slug,
          logoPath: null,
          phone: '0118 950 1148',
          email: 'loser@test-agency.example.co.uk',
          website: 'https://test-agency.example.co.uk',
          address: '2 Test Street, Reading',
          verified: false,
          createdBy: owner.id,
        }),
      ).rejects.toBeInstanceOf(AgencySlugConflictError)

      expect(await agencyRepository.findBySlug(slug)).toEqual(winner)
    })
  },
)
