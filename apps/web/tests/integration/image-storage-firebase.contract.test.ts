import { describe } from 'vitest'

import { FirebaseStorageAdapter } from '@/adapters/firebase'

import { runImageStorageContractTests } from './image-storage.contract'

// The real-bucket half of PRD §8.7's exit criterion — see
// image-storage.contract.ts's doc comment for the full fake/real split.
// Gated on TEST_FIREBASE_STORAGE_BUCKET (not the FIREBASE_STORAGE_BUCKET
// production var) so this suite never fires just because the app's own
// runtime env is configured — it has to be opted into explicitly, same
// spirit as TEST_DATABASE_URL vs DATABASE_URL for the Drizzle integration
// suites in this directory. Requires the same FIREBASE_PROJECT_ID /
// FIREBASE_CLIENT_EMAIL / FIREBASE_PRIVATE_KEY (or
// FIREBASE_SERVICE_ACCOUNT_B64) credentials admin-app.ts already reads —
// already present in .env.local for the my-shop-cdeac dev project.
//
// Run locally with:
//   TEST_FIREBASE_STORAGE_BUCKET=my-shop-cdeac.firebasestorage.app pnpm test:integration
//
// vitest does not load .env files itself (no such config in
// vitest.config.mts), so either export the var in the shell first or
// prefix the command with it, as above — matching how TEST_DATABASE_URL
// is documented to be supplied in .env.example.
const TEST_FIREBASE_STORAGE_BUCKET = process.env.TEST_FIREBASE_STORAGE_BUCKET

describe.skipIf(!TEST_FIREBASE_STORAGE_BUCKET)(
  'FirebaseStorageAdapter (real bucket)',
  () => {
    runImageStorageContractTests('FirebaseStorageAdapter (real bucket)', () => {
      return new FirebaseStorageAdapter({
        ...process.env,
        FIREBASE_STORAGE_BUCKET: TEST_FIREBASE_STORAGE_BUCKET,
      })
    })
  },
)
