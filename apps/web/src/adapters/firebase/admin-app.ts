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

  // Rebuild canonical PEM from the markers outward: strip every kind of
  // whitespace from the base64 body (paste often collapses newlines into
  // spaces, which OpenSSL rejects) and rewrap at 64 columns.
  const match = key.match(
    /-----BEGIN ([A-Z0-9 ]+)-----([\s\S]*?)-----END \1-----/,
  )
  if (match) {
    const label = match[1]
    const body = match[2].replace(/\s/g, '')
    const wrapped = body.match(/.{1,64}/g)?.join('\n') ?? body
    return `-----BEGIN ${label}-----\n${wrapped}\n-----END ${label}-----\n`
  }

  return key.endsWith('\n') ? key : key + '\n'
}

export interface ServiceAccountCredentials {
  projectId: string
  clientEmail: string
  privateKey: string
}

/**
 * Resolves Admin SDK credentials from the environment. Two supported
 * shapes, in priority order:
 *
 * 1. FIREBASE_SERVICE_ACCOUNT_B64 — the entire service-account JSON,
 *    base64-encoded to a single line. Preferred for hosted env-var UIs:
 *    a single-line base64 blob survives any paste intact, whereas a raw
 *    multi-line PEM routinely arrives with collapsed newlines, wrapping
 *    quotes, or truncation that no amount of normalisation can repair.
 *    Generate with: base64 -i service-account.json
 * 2. FIREBASE_PROJECT_ID + FIREBASE_CLIENT_EMAIL + FIREBASE_PRIVATE_KEY —
 *    the individual values (canonical for local .env.local).
 */
export function resolveServiceAccount(
  env: Record<string, string | undefined>,
): ServiceAccountCredentials {
  const b64 = env.FIREBASE_SERVICE_ACCOUNT_B64
  if (b64) {
    let parsed: {
      project_id?: string
      client_email?: string
      private_key?: string
    }
    try {
      parsed = JSON.parse(Buffer.from(b64.trim(), 'base64').toString('utf8'))
    } catch {
      throw new Error(
        'FIREBASE_SERVICE_ACCOUNT_B64 is set but is not base64-encoded service-account JSON.',
      )
    }
    if (!parsed.project_id || !parsed.client_email || !parsed.private_key) {
      throw new Error(
        'FIREBASE_SERVICE_ACCOUNT_B64 decoded, but the JSON is missing project_id, client_email or private_key.',
      )
    }
    return {
      projectId: parsed.project_id,
      clientEmail: parsed.client_email,
      privateKey: normalizePrivateKey(parsed.private_key),
    }
  }

  return {
    projectId: readEnvFrom(env, 'FIREBASE_PROJECT_ID'),
    clientEmail: readEnvFrom(env, 'FIREBASE_CLIENT_EMAIL'),
    privateKey: normalizePrivateKey(readEnvFrom(env, 'FIREBASE_PRIVATE_KEY')),
  }
}

function readEnvFrom(
  env: Record<string, string | undefined>,
  name: string,
): string {
  const value = env[name]
  if (!value) {
    throw new Error(
      `${name} is not set. It is required to initialise the Firebase Admin app.`,
    )
  }
  return value
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

  app = initializeApp({ credential: cert(resolveServiceAccount(process.env)) })
  return app
}
