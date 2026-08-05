/**
 * FirebaseStorageAdapter — the ImageStorage (ports/) implementation
 * backed by Firebase/Google Cloud Storage (PRD §8.7). Reuses
 * getAdminApp() (admin-app.ts) for the same lazily-initialised singleton
 * Admin app FirebaseAuthGateway shares; firebase-admin/storage is
 * dynamic-imported for the identical reason admin-app.ts's getAdminApp()
 * and firebase-auth-gateway.ts's adminAuth() are — a top-level import
 * would take down every route that transitively imports the composition
 * root on runtimes that can't require() firebase-admin's CJS/ESM-mixed
 * dependency graph (see admin-app.ts's doc comment).
 *
 * Signed uploads: V4 signed URLs (`action: 'write'`), with content-type
 * and a max-size bound baked into the signature via GCS's
 * `X-Goog-Content-Length-Range` extension header (`0,{maxBytes}`) — GCS
 * enforces that range against the actual upload server-side, independent
 * of whatever a client claims the file's size is (PRD §7.4: "signed URLs
 * with short TTL and content-type/size constraints"). The same header
 * value comes back in `SignedUploadUrl.headers` so the caller's PUT can
 * include it — omitting it, or sending a different value, invalidates the
 * signature and GCS rejects the request with a 403.
 *
 * Public URLs: the `firebaseStorageDownloadTokens` metadata pattern (PRD
 * §8.7 point 3: "long-cache immutable variant paths"), not a V4 *read*
 * signed URL. A read signed URL expires (GCS caps V4 signatures at 7
 * days), which is the wrong shape for a URL meant to be cached
 * indefinitely and embedded in rendered pages — the token-based download
 * URL has no expiry. `publicUrl()` reads the token off the object's
 * custom metadata, generating and persisting one the first time it's
 * called for a given path (the same thing the Firebase Console's "get
 * download URL" button does under the hood). `buildDownloadUrl()` below
 * produces the identical URL shape firebase-admin/storage's own
 * `getDownloadURL()` helper does — factored out here, rather than reused
 * from there, because that helper throws when no token exists yet instead
 * of minting one, which is exactly the case this adapter has to handle.
 *
 * Cache-Control: `put()` sets a long-cache, immutable header for anything
 * under a `variants/` path segment (domain/image-storage-path.ts's
 * `variantImagePath` scheme) — the only paths `publicUrl()` is ever
 * called for. Originals (`original/` paths) are never served publicly
 * (PRD §8.7 point 3) and get no such header.
 *
 * Storage emulator support (dev/CI without a live bucket — see
 * firebase.json/storage.rules at the repo root): FIREBASE_STORAGE_EMULATOR_HOST
 * (or STORAGE_EMULATOR_HOST) is the same pair firebase-admin's own Storage
 * service reads — see the `Storage` class in firebase-admin/lib/storage/
 * storage.js, which rewrites FIREBASE_STORAGE_EMULATOR_HOST into
 * STORAGE_EMULATOR_HOST (adding an `http://` prefix) the first time a
 * Storage instance is constructed, purely as a side effect of that one
 * env var being set. From there @google-cloud/storage's own constructor
 * (storage.js) picks up STORAGE_EMULATOR_HOST directly. Net effect,
 * verified empirically against firebase-tools 15.9.0's storage emulator:
 * `put()`/`get()`/`exists()`/`delete()` below need ZERO code changes to
 * redirect to the emulator — the Admin SDK's bucket() calls they're built
 * on already honor it.
 *
 * The other two methods are not that simple, and both needed a real
 * emulator running locally to find out why (rather than assuming):
 *
 *  - `createSignedUploadUrl()`: a V4 signed URL still *generates*
 *    correctly offline (the RSA signature is computed locally from the
 *    service-account private key — no network call), and its host
 *    correctly points at the emulator (@google-cloud/storage's signer
 *    builds the URL from `storage.apiEndpoint`, which is the emulator
 *    host once STORAGE_EMULATOR_HOST is set) — but a PUT to that URL
 *    gets back `501 Not Implemented`. The storage emulator does not
 *    implement the GCS XML API's signed-PUT-to-object endpoint at all
 *    (only a GET at that path shape, for downloads). What it *does*
 *    implement is its own Firebase-specific `/v0/b/{bucket}/o/{object}`
 *    REST surface, whose PUT handler (no `x-goog-upload-protocol`
 *    header, i.e. a plain single-request body) accepts raw bytes and
 *    finalises the object in one call — exactly the "one PUT, whole file
 *    in the body" shape `lib/images-client.ts`'s `uploadOriginalBytes`
 *    already sends. So under emulation this method skips real V4 signing
 *    entirely and returns that `/v0` URL instead (`buildEmulatorUploadUrl`
 *    below) — there is nothing to sign against, since the emulator does
 *    not check the signature anyway.
 *  - `publicUrl()`: the production download-token URL
 *    (`buildDownloadUrl`) is hardcoded to `firebasestorage.googleapis.com`
 *    — a real, public Google endpoint that doesn't exist for emulated
 *    data. The emulator serves the identical `/v0/b/{bucket}/o/{path}?
 *    alt=media&token={token}` shape (confirmed empirically — same path,
 *    same query params, same 200-with-bytes response) from its own
 *    host:port instead, so `buildDownloadUrl` takes an optional base URL
 *    parameter and this method passes the emulator's when one is
 *    configured.
 *
 * Both branches are pure URL-string construction with no adapter method
 * call that isn't already unit-tested elsewhere in this file's test
 * companion — see `buildEmulatorUploadUrl` and `buildDownloadUrl`'s
 * `baseUrl` parameter.
 */

import { randomUUID } from 'node:crypto'

import type {
  CreateSignedUploadUrlOptions,
  ImageStorage,
  SignedUploadUrl,
} from '@/ports/image-storage'

import { getAdminApp } from './admin-app'

const DOWNLOAD_URL_ENDPOINT = 'https://firebasestorage.googleapis.com/v0'
const VARIANT_CACHE_CONTROL = 'public, max-age=31536000, immutable'

/** Reads FIREBASE_STORAGE_BUCKET, throwing a message that tells the
 * operator exactly what to set — mirrors adapters/drizzle/client.ts's
 * resolveDatabaseUrl and admin-app.ts's readEnvFrom. */
export function resolveStorageBucket(
  env: Record<string, string | undefined>,
): string {
  const bucket = env.FIREBASE_STORAGE_BUCKET
  if (!bucket) {
    throw new Error(
      'FIREBASE_STORAGE_BUCKET is not set. It is required to initialise ' +
        "FirebaseStorageAdapter — set it to your Firebase project's " +
        'storage bucket, e.g. FIREBASE_STORAGE_BUCKET=my-project.firebasestorage.app.',
    )
  }
  return bucket
}

/** True for any path under a `variants/` segment — the only paths
 * `publicUrl()` is ever called for, and the only ones `put()` writes with
 * a long-cache header. Pure and exported so it's unit-testable without a
 * live bucket. */
export function isVariantPath(path: string): boolean {
  return path.split('/').includes('variants')
}

/** Builds the same download-URL shape firebase-admin/storage's own
 * `getDownloadURL()` helper produces for a bucket, object path and
 * download token. Pure and exported so it's unit-testable without a live
 * bucket. `baseUrl` defaults to the real Firebase Storage endpoint;
 * `publicUrl()` below passes the Storage emulator's instead when one is
 * configured — same path/query shape, different host (see this file's
 * header comment). */
export function buildDownloadUrl(
  bucket: string,
  path: string,
  token: string,
  baseUrl: string = DOWNLOAD_URL_ENDPOINT,
): string {
  return `${baseUrl}/b/${bucket}/o/${encodeURIComponent(path)}?alt=media&token=${token}`
}

/** Reads the Storage emulator host (bare `host:port`, no scheme) from
 * either FIREBASE_STORAGE_EMULATOR_HOST or STORAGE_EMULATOR_HOST — the
 * same two vars, same precedence (STORAGE_EMULATOR_HOST wins if both are
 * set), that firebase-admin's own Storage service reads (see this file's
 * header comment). Strips an `http(s)://` prefix if present, since
 * STORAGE_EMULATOR_HOST may already carry one (firebase-admin adds one
 * when rewriting from FIREBASE_STORAGE_EMULATOR_HOST) but this adapter's
 * emulator-branch URL builders below need a bare host to prefix with
 * their own `http://`. Pure and exported so it's unit-testable without a
 * live emulator. */
export function resolveStorageEmulatorHost(
  env: Record<string, string | undefined>,
): string | undefined {
  const raw = env.STORAGE_EMULATOR_HOST ?? env.FIREBASE_STORAGE_EMULATOR_HOST
  return raw?.replace(/^https?:\/\//, '')
}

/** Builds the Storage emulator's one-shot upload URL for `path` — the
 * `/v0/b/{bucket}/o/{object}` REST endpoint's PUT handler, which (absent
 * an `x-goog-upload-protocol` header) accepts the whole file as a single
 * request body and finalises the object immediately. This is what
 * `createSignedUploadUrl()` returns instead of a real V4 signed URL when
 * an emulator host is configured — see this file's header comment for
 * why a real signed URL doesn't work against the emulator. Pure and
 * exported so it's unit-testable without a live emulator. */
export function buildEmulatorUploadUrl(
  emulatorHost: string,
  bucket: string,
  path: string,
): string {
  return `http://${emulatorHost}/v0/b/${bucket}/o/${encodeURIComponent(path)}`
}

async function adminBucket(bucketName: string) {
  const { getStorage } = await import('firebase-admin/storage')
  return getStorage(await getAdminApp()).bucket(bucketName)
}

export class FirebaseStorageAdapter implements ImageStorage {
  private readonly env: Record<string, string | undefined>

  /** Reads no env var and calls no Admin SDK code in the constructor —
   * mirrors adapters/drizzle/client.ts's getDb() and admin-app.ts's
   * getAdminApp(), both lazy for the same reason: lib/composition.ts's
   * createServices() constructs every adapter eagerly on every request,
   * so a constructor that throws for a missing env var would break every
   * route, not just the image ones, whenever FIREBASE_STORAGE_BUCKET is
   * unset. resolveStorageBucket() only actually runs the first time a
   * method below is called. */
  constructor(env: Record<string, string | undefined> = process.env) {
    this.env = env
  }

  private async bucket() {
    return adminBucket(resolveStorageBucket(this.env))
  }

  async createSignedUploadUrl(
    path: string,
    options: CreateSignedUploadUrlOptions,
  ): Promise<SignedUploadUrl> {
    const emulatorHost = resolveStorageEmulatorHost(this.env)
    if (emulatorHost) {
      // No real V4 signing under emulation — see this file's header
      // comment for why a real signed URL 501s against the emulator, and
      // why its own /v0 upload endpoint is the correct substitute. No
      // bucket() call needed either: this is pure URL construction, not
      // a network call.
      return {
        url: buildEmulatorUploadUrl(
          emulatorHost,
          resolveStorageBucket(this.env),
          path,
        ),
        headers: { 'Content-Type': options.contentType },
      }
    }

    const bucket = await this.bucket()
    const sizeRangeHeader = `0,${options.maxBytes}`

    const [url] = await bucket.file(path).getSignedUrl({
      version: 'v4',
      action: 'write',
      expires: Date.now() + options.expiresInMs,
      contentType: options.contentType,
      extensionHeaders: {
        'X-Goog-Content-Length-Range': sizeRangeHeader,
      },
    })

    return {
      url,
      headers: {
        'Content-Type': options.contentType,
        'X-Goog-Content-Length-Range': sizeRangeHeader,
      },
    }
  }

  async put(
    path: string,
    bytes: Uint8Array,
    contentType: string,
  ): Promise<void> {
    const bucket = await this.bucket()
    await bucket.file(path).save(Buffer.from(bytes), {
      contentType,
      ...(isVariantPath(path)
        ? { metadata: { cacheControl: VARIANT_CACHE_CONTROL } }
        : {}),
    })
  }

  async get(path: string): Promise<Uint8Array | null> {
    const bucket = await this.bucket()
    const file = bucket.file(path)
    const [exists] = await file.exists()
    if (!exists) return null
    const [buffer] = await file.download()
    return new Uint8Array(buffer)
  }

  async exists(path: string): Promise<boolean> {
    const bucket = await this.bucket()
    const [exists] = await bucket.file(path).exists()
    return exists
  }

  async delete(path: string): Promise<void> {
    const bucket = await this.bucket()
    await bucket.file(path).delete({ ignoreNotFound: true })
  }

  async publicUrl(path: string): Promise<string> {
    const bucket = await this.bucket()
    const file = bucket.file(path)

    const [metadata] = await file.getMetadata()
    const storedTokens = metadata.metadata?.firebaseStorageDownloadTokens
    const existingToken =
      typeof storedTokens === 'string' ? storedTokens.split(',')[0] : undefined

    const token = existingToken ?? randomUUID()
    if (!existingToken) {
      await file.setMetadata({
        metadata: { firebaseStorageDownloadTokens: token },
      })
    }

    const emulatorHost = resolveStorageEmulatorHost(this.env)
    const baseUrl = emulatorHost ? `http://${emulatorHost}/v0` : undefined

    return buildDownloadUrl(
      resolveStorageBucket(this.env),
      path,
      token,
      baseUrl,
    )
  }
}
