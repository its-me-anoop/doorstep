import { generateKeyPairSync } from 'node:crypto'
import { describe } from 'vitest'

import { FirebaseStorageAdapter } from '@/adapters/firebase'
import { resolveStorageEmulatorHost } from '@/adapters/firebase/firebase-storage-adapter'

import { runImageStorageContractTests } from './image-storage.contract'

// The Storage-emulator half of PRD §8.7's exit criterion — see
// image-storage.contract.ts's doc comment for the fake/real split this
// file adds a third leg to. Where image-storage-firebase.contract.test.ts
// needs a real bucket on a real project (gated on
// TEST_FIREBASE_STORAGE_BUCKET, local-only, never in CI), this file runs
// the exact same suite against the REAL FirebaseStorageAdapter — the same
// class production traffic goes through — pointed at a local
// `firebase emulators:start --only storage` instead. No live GCS bucket,
// no live Firebase project, no billing account required: the M1 dev
// project (my-shop-cdeac) currently has neither, which is exactly the gap
// this file closes — and closes permanently in CI
// (.github/workflows/ci.yml's integration job), not just locally.
//
// Gated on resolveStorageEmulatorHost(process.env) rather than a
// standalone env check so this suite's "should I run" decision uses
// literally the same rule the adapter uses to decide "should I branch
// into emulator mode" (firebase-storage-adapter.ts) — no separate env var
// name to keep in sync.
//
// The bucket name is an arbitrary constant, not read from any env var:
// the whole point of running against the emulator is that the bucket
// does not need to correspond to a real one on a real project — the
// emulator creates it on first write. Run locally with:
//   pnpm emulator:storage
//   FIREBASE_STORAGE_EMULATOR_HOST=127.0.0.1:9199 pnpm test:integration
const EMULATOR_HOST = resolveStorageEmulatorHost(process.env)
const EMULATOR_TEST_BUCKET = 'demo-doorstep-emulator.firebasestorage.app'

// admin-app.ts's getAdminApp() reads FIREBASE_PROJECT_ID/CLIENT_EMAIL/
// PRIVATE_KEY straight from process.env, not from the env map this suite
// passes into FirebaseStorageAdapter below (which only overrides
// FIREBASE_STORAGE_BUCKET) — and firebase-admin's cert() parses
// PRIVATE_KEY *immediately*, at getAdminApp() call time. Verified
// empirically: a syntactically-plausible-but-truncated PEM literal (like
// ci.yml's `build` job placeholder, which next build never actually
// feeds to cert()) throws "DECODER routines::unsupported" the instant a
// real adapter call happens, so this suite needs a *structurally valid*
// RSA key — but not one tied to a real, registered service account:
// every GCS call below redirects to the emulator (FIREBASE_STORAGE_
// EMULATOR_HOST, above), which never checks the signature or the key's
// registration (also verified empirically). When the environment already
// has real credentials configured (a developer's .env.local), those are
// left alone and reused as-is. Only fills the gap when nothing is
// configured (CI, or any machine with no Firebase project set up at
// all) — generating one exactly the way playwright.config.ts's
// THROWAWAY_PRIVATE_KEY does, for the identical reason (a key that must
// merely parse, never authenticate against anything real).
if (EMULATOR_HOST && !process.env.FIREBASE_PROJECT_ID) {
  process.env.FIREBASE_PROJECT_ID = 'demo-doorstep-emulator'
  process.env.FIREBASE_CLIENT_EMAIL =
    'firebase-adminsdk-emulator@demo-doorstep-emulator.iam.gserviceaccount.com'
  process.env.FIREBASE_PRIVATE_KEY = generateKeyPairSync('rsa', {
    modulusLength: 2048,
  }).privateKey.export({ type: 'pkcs8', format: 'pem' }) as string
}

describe.skipIf(!EMULATOR_HOST)(
  'FirebaseStorageAdapter (Storage emulator)',
  () => {
    runImageStorageContractTests(
      'FirebaseStorageAdapter (Storage emulator)',
      () => {
        return new FirebaseStorageAdapter({
          ...process.env,
          FIREBASE_STORAGE_BUCKET: EMULATOR_TEST_BUCKET,
        })
      },
    )
  },
)
