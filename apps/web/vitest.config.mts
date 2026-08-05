import path from 'node:path'
import { fileURLToPath } from 'node:url'

import react from '@vitejs/plugin-react'
import { defineConfig } from 'vitest/config'

const dirname = path.dirname(fileURLToPath(import.meta.url))

// Vitest 4 dropped `environmentMatchGlobs` in favour of `projects` — this
// keeps the same intent (node runtime for domain/service unit tests, jsdom
// for anything that renders components) as two projects sharing one config.
export default defineConfig({
  resolve: {
    alias: {
      '@': path.resolve(dirname, './src'),
    },
  },
  test: {
    globals: true,
    setupFiles: ['./tests/setup.ts'],
    projects: [
      {
        extends: true,
        test: {
          name: 'node',
          environment: 'node',
          include: ['tests/unit/**/*.test.{ts,tsx}'],
          exclude: ['tests/unit/components/**'],
        },
      },
      {
        extends: true,
        test: {
          name: 'integration',
          environment: 'node',
          include: ['tests/integration/**/*.test.{ts,tsx}'],
          // Every file in this project migrates the same live database in
          // its own beforeAll (see tests/integration/db.schema.test.ts and
          // agency-repository.test.ts). Against an already-migrated
          // database that's a harmless no-op, but against a genuinely
          // fresh one (CI's postgis service container, PRD §8.8) two
          // files calling migrate() concurrently race on Postgres's own
          // "IF NOT EXISTS" DDL — CREATE EXTENSION/CREATE SCHEMA are not
          // safely idempotent under concurrent transactions, so both can
          // see the object as absent and both attempt the insert, one
          // losing to a unique-constraint violation. Running this
          // project's files one at a time means the second file's
          // migrate() always sees the first file's migration already
          // committed, and skips it.
          fileParallelism: false,
        },
      },
      {
        extends: true,
        plugins: [react()],
        test: {
          name: 'dom',
          environment: 'jsdom',
          include: ['tests/unit/components/**/*.test.{ts,tsx}'],
        },
      },
    ],
  },
})
