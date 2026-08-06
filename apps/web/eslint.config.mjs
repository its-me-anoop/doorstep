import { defineConfig, globalIgnores } from 'eslint/config'
import nextVitals from 'eslint-config-next/core-web-vitals'
import nextTs from 'eslint-config-next/typescript'

// Boundary enforcement for the domain/services/ports/adapters split
// (PRD §8.5). These rules are the mechanical backstop for DIP: domain/
// and services/ must stay framework-free, and app/ must reach adapters
// only through the lib/composition.ts composition root.
const frameworkAndAdapterImports = [
  {
    group: ['next', 'next/*'],
    message:
      'domain/ and services/ must stay framework-free. No Next.js imports.',
  },
  {
    group: ['react', 'react-dom', 'react/*', 'react-dom/*'],
    message:
      'domain/ and services/ must stay framework-free. No React imports.',
  },
  {
    group: ['drizzle-orm', 'drizzle-orm/*'],
    message:
      'domain/ and services/ must depend on ports/, not on Drizzle directly.',
  },
  {
    group: ['firebase', 'firebase/*', 'firebase-admin', 'firebase-admin/*'],
    message:
      'domain/ and services/ must depend on ports/, not on Firebase directly.',
  },
  {
    group: ['@/adapters/*', '@/adapters', '**/adapters/**'],
    message:
      'domain/ and services/ must depend on ports/, not on adapters/ directly.',
  },
]

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  {
    files: ['src/domain/**/*.{ts,tsx}', 'src/services/**/*.{ts,tsx}'],
    rules: {
      'no-restricted-imports': [
        'error',
        { patterns: frameworkAndAdapterImports },
      ],
    },
  },
  {
    files: ['src/app/**/*.{ts,tsx}'],
    rules: {
      'no-restricted-imports': [
        'error',
        {
          patterns: [
            {
              group: ['@/adapters/*', '@/adapters', '**/adapters/**'],
              message:
                'app/ may not import adapters/ directly — call createServices() from @/lib/composition instead.',
            },
          ],
        },
      ],
    },
  },
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    '.next/**',
    'out/**',
    'build/**',
    'next-env.d.ts',
    // scripts/vendor-maplibre-worker.ts's committed output — third-party
    // maplibre-gl build artifacts copied verbatim (see
    // src/components/features/search/map/maplibre-adapter.ts's own doc
    // comment for why), not this project's own source.
    'public/vendor/**',
  ]),
])

export default eslintConfig
