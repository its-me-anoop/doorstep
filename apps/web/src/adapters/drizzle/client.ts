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

/**
 * DATABASE_URL is this project's canonical name (.env.example, README).
 * POSTGRES_URL is accepted as a fallback because Vercel's marketplace
 * database integrations (e.g. Neon) inject the connection string under
 * that name when connecting a store to a project.
 */
export function resolveDatabaseUrl(
  env: Record<string, string | undefined>,
): string {
  const url = env.DATABASE_URL || env.POSTGRES_URL
  if (!url) {
    throw new Error(
      'Neither DATABASE_URL nor POSTGRES_URL is set. One is required to create the Drizzle client.',
    )
  }
  return url
}

/** Returns the singleton Drizzle client, creating it (and the underlying
 * connection pool) on first use. */
export function getDb(): Db {
  if (!db) {
    const client = postgres(resolveDatabaseUrl(process.env), { max: 10 })
    db = drizzle(client, { schema })
  }
  return db
}
