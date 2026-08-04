/**
 * Lazy Drizzle client factory. Never connects at import time — the
 * `postgres` client and the Drizzle instance are only created the first
 * time `getDb()` is called, so importing this module (e.g. transitively,
 * via the composition root) has no side effects and does not require
 * DATABASE_URL to be set. See PRD §8.5.
 */

import { drizzle } from 'drizzle-orm/postgres-js'
import postgres from 'postgres'

import * as schema from './schema'

export type Db = ReturnType<typeof drizzle<typeof schema>>

let db: Db | undefined

function readDatabaseUrl(): string {
  const url = process.env.DATABASE_URL
  if (!url) {
    throw new Error(
      'DATABASE_URL is not set. It is required to create the Drizzle client.',
    )
  }
  return url
}

/** Returns the singleton Drizzle client, creating it (and the underlying
 * connection pool) on first use. */
export function getDb(): Db {
  if (!db) {
    const client = postgres(readDatabaseUrl(), { max: 10 })
    db = drizzle(client, { schema })
  }
  return db
}
