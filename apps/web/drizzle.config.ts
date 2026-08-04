import { defineConfig } from 'drizzle-kit'

// Reads DATABASE_URL from the environment. There is no live database on
// this machine (no Docker either) — migrations are generated and
// inspected here, then applied for real in CI service containers and in
// Neon branch previews. See PRD §8.5, §8.8.
const databaseUrl = process.env.DATABASE_URL ?? ''

export default defineConfig({
  dialect: 'postgresql',
  schema: './src/adapters/drizzle/schema.ts',
  out: './src/adapters/drizzle/migrations',
  dbCredentials: {
    url: databaseUrl,
  },
  strict: true,
  verbose: true,
})
