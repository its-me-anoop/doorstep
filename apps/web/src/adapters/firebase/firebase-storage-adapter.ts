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
 * bucket. */
export function buildDownloadUrl(
  bucket: string,
  path: string,
  token: string,
): string {
  return `${DOWNLOAD_URL_ENDPOINT}/b/${bucket}/o/${encodeURIComponent(path)}?alt=media&token=${token}`
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

    return buildDownloadUrl(resolveStorageBucket(this.env), path, token)
  }
}
