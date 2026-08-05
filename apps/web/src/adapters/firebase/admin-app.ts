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
 * Normalises the common shapes `FIREBASE_PRIVATE_KEY` arrives in when
 * pasted into an env-var UI: surrounding whitespace, wrapping single or
 * double quotes (copied straight from the service-account JSON or a .env
 * file), and literal `\n` escapes instead of real newlines. OpenSSL
 * rejects a PEM with any of these intact ("DECODER routines::unsupported"),
 * which surfaces as a hard-to-diagnose 500 in production.
 */
export function normalizePrivateKey(raw: string): string {
  let key = raw.trim()
  const first = key[0]
  if ((first === '"' || first === "'") && key.endsWith(first)) {
    key = key.slice(1, -1)
  }
  key = key.replace(/\\n/g, '\n')
  return key.endsWith('\n') ? key : key + '\n'
}

function readPrivateKey(): string {
  return normalizePrivateKey(readEnv('FIREBASE_PRIVATE_KEY'))
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
