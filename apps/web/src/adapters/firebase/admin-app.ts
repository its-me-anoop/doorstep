/**
 * Lazy Firebase Admin SDK app factory. Never initialises at import time —
 * the App instance is only created the first time getAdminApp() is
 * called, so importing this module (e.g. transitively, via the
 * composition root) has no side effects and does not require
 * FIREBASE_PROJECT_ID/FIREBASE_CLIENT_EMAIL/FIREBASE_PRIVATE_KEY to be
 * set. Mirrors adapters/drizzle/client.ts's getDb(). See PRD §8.4.
 */

import type { App } from 'firebase-admin/app'

let app: App | undefined

function readEnv(name: string): string {
  const value = process.env[name]
  if (!value) {
    throw new Error(
      `${name} is not set. It is required to initialise the Firebase Admin app.`,
    )
  }
  return value
}

/**
 * `FIREBASE_PRIVATE_KEY` is stored with literal `\n` escapes (most
 * hosting env-var UIs, including Vercel's, don't preserve real newlines
 * in multi-line values) — unescape them back into a real PEM key.
 */
function readPrivateKey(): string {
  return readEnv('FIREBASE_PRIVATE_KEY').replace(/\\n/g, '\n')
}

/** Returns the singleton Admin app, creating it on first use. Reuses an
 * already-initialised app (e.g. from a hot-reloaded module) instead of
 * calling initializeApp() twice, which firebase-admin rejects.
 *
 * firebase-admin is loaded via dynamic import(), not a top-level import:
 * its CJS dependency chain (jwks-rsa require()ing the ESM-only jose)
 * cannot be loaded on Node runtimes without require(esm), and a
 * top-level import would take down every route that transitively
 * imports the composition root — including public pages that never
 * touch auth. Deferring the load keeps public rendering independent of
 * the auth vendor's module graph. */
export async function getAdminApp(): Promise<App> {
  if (app) return app

  const { cert, getApps, initializeApp } = await import('firebase-admin/app')

  const existing = getApps()[0]
  if (existing) {
    app = existing
    return app
  }

  app = initializeApp({
    credential: cert({
      projectId: readEnv('FIREBASE_PROJECT_ID'),
      clientEmail: readEnv('FIREBASE_CLIENT_EMAIL'),
      privateKey: readPrivateKey(),
    }),
  })
  return app
}
