/**
 * ImageStorage — fronts Firebase Storage today (adapters/firebase/
 * firebase-storage-adapter.ts); a future CloudinaryAdapter must satisfy
 * this same contract (LSP) so the wizard and image pipeline never know
 * which vendor is behind it (PRD §8.7 point 4). Narrow and vendor-free:
 * every method takes/returns plain strings, bytes and dates, nothing from
 * the Firebase or GCS SDKs leaks through.
 *
 * Path convention: every `path` here is a full storage key (e.g.
 * `listings/{propertyId}/original/{imageId}` or
 * `.../variants/{imageId}/800.webp` — see domain/image-storage-path.ts),
 * not a bucket-relative fragment the adapter has to build.
 *
 * Contract enforced by tests/integration/image-storage.contract.ts,
 * PRD §8.7's exit criterion ("contract tests green on the storage
 * adapter") — run against both a documented in-memory fake (always) and
 * the real adapter (gated on a live bucket being configured). Any
 * ImageStorage implementation, including one written in the future, must
 * pass that suite.
 *
 * `publicUrl` is async everywhere (`Promise<string>`, not the narrower
 * `string`) even though the interface's return type technically allows a
 * sync string: Firebase's long-cache-immutable public URL is built from a
 * per-object `firebaseStorageDownloadTokens` metadata value (PRD §8.7
 * point 3's "long-cache immutable variant paths"), which can only be read
 * (and, the first time, written) via a network call to the object's
 * metadata — there is no way to derive it from the path alone. Every
 * implementation, including a future Cloudinary one, should keep
 * returning a Promise so callers don't need to special-case a vendor that
 * happens to support a synchronous variant.
 */

export interface SignedUploadUrl {
  /** The URL the client PUTs the file's bytes to directly. */
  url: string
  /** Headers the client's PUT request MUST include for the upload to be
   * accepted — e.g. Firebase's V4 signed URLs bind `Content-Type` and a
   * `X-Goog-Content-Length-Range` size constraint into the signature
   * itself, so the same headers used to sign the URL must be replayed on
   * the actual request or GCS rejects it. Omitted when an implementation
   * has no such requirement. */
  headers?: Record<string, string>
}

export interface CreateSignedUploadUrlOptions {
  contentType: string
  maxBytes: number
  expiresInMs: number
}

export interface ImageStorage {
  /** Issues a short-lived URL the client uploads directly to (PRD §6.5
   * LST-3: "uploads go directly to storage via short-lived signed URLs"),
   * constrained to `options.contentType` and at most `options.maxBytes`,
   * valid for `options.expiresInMs` from the call. Does not itself write
   * anything — nothing exists at `path` until the client's PUT lands. */
  createSignedUploadUrl(
    path: string,
    options: CreateSignedUploadUrlOptions,
  ): Promise<SignedUploadUrl>
  /** Writes `bytes` to `path` directly (server-side), used by the
   * processing step to store generated variants — see
   * services/images/process-image.ts. Overwrites whatever was already at
   * `path`. Implementations set a long-cache, immutable Cache-Control on
   * anything written under a `variants/` path (PRD §8.7 point 3);
   * originals get no such header since they are never served publicly. */
  put(path: string, bytes: Uint8Array, contentType: string): Promise<void>
  /** Reads the bytes at `path` back, or null if nothing is stored there. */
  get(path: string): Promise<Uint8Array | null>
  /** True if an object exists at `path`. */
  exists(path: string): Promise<boolean>
  /** Deletes whatever is at `path`. A no-op, not an error, when nothing is
   * there — mirrors DELETE being idempotent everywhere else in this API
   * (PRD §10). */
  delete(path: string): Promise<void>
  /** The long-cache, immutable public URL for the object at `path` (PRD
   * §8.7 point 3). Only ever called for a `variants/` path — originals
   * are never served publicly, so calling this for an `original/` path is
   * a caller error, not something this port defends against. */
  publicUrl(path: string): Promise<string>
}
