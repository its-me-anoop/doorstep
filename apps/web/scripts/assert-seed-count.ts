/**
 * CI-only assertion, run after scripts/seed.ts against the postgis
 * service container (.github/workflows/ci.yml `integration` job): confirms
 * exactly the 20 PRD-specified seed properties exist.
 *
 * Counts by joining through users.firebase_uid's `seed-` prefix rather
 * than a raw `count(*) from properties`, because
 * tests/integration/db.schema.test.ts also inserts one throwaway
 * property+user into the same database as part of the same job — this
 * way the assertion is correct regardless of step order.
 */

import { count, eq, like } from 'drizzle-orm'

import { getDb, schema } from '@/adapters/drizzle'

const EXPECTED_SEED_PROPERTY_COUNT = 20

async function main(): Promise<void> {
  const db = getDb()
  const [row] = await db
    .select({ value: count() })
    .from(schema.properties)
    .innerJoin(schema.users, eq(schema.users.id, schema.properties.listerId))
    .where(like(schema.users.firebaseUid, 'seed-%'))

  const actual = row?.value ?? 0
  if (actual !== EXPECTED_SEED_PROPERTY_COUNT) {
    console.error(
      `Expected ${EXPECTED_SEED_PROPERTY_COUNT} seeded properties, found ${actual}.`,
    )
    process.exit(1)
  }
  console.log(`Seed assertion passed: ${actual} seeded properties found.`)
}

main()
  .then(() => process.exit(0))
  .catch((error: unknown) => {
    console.error('Seed assertion script failed:', error)
    process.exit(1)
  })
