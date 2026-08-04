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
          include: [
            'tests/unit/**/*.test.{ts,tsx}',
            'tests/integration/**/*.test.{ts,tsx}',
          ],
          exclude: ['tests/unit/components/**'],
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
