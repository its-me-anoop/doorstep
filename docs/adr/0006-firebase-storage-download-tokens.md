# ADR-0006: Firebase Storage download tokens for public image URLs

## Status

Accepted — M1.

## Context

PRD §8.7 point 3 requires image variant URLs to be "long-cache immutable
variant paths"; the wizard and public listing pages are expected to embed
these URLs directly in `<img src>` and rely on aggressive CDN/browser
caching, since a variant's bytes never change once
`services/images/process-image.ts` writes them (a new upload gets a new
`imageId` and therefore a new path — nothing is ever overwritten in place).
PRD §8.7 point 4 additionally requires that swapping `ImageStorage`'s
Firebase-backed implementation for a future Cloudinary adapter be "an
adapter swap plus a URL migration script, with zero changes in domain or UI
code" — so whatever URL scheme is chosen has to be produced entirely inside
`adapters/firebase/firebase-storage-adapter.ts`, behind the vendor-neutral
`ImageStorage` port (`src/ports/image-storage.ts`).

Google Cloud Storage (the storage layer Firebase Storage sits on) offers two
ways to hand out a URL for a private object without making the bucket
world-readable:

1. **V4 signed URLs** (`action: 'read'`) — the same mechanism this codebase
   already uses for uploads (`createSignedUploadUrl`, `action: 'write'`).
   GCS hard-caps every V4 signature's validity at **7 days**; there is no
   way to mint one that lasts longer, expiry is baked into the signed query
   string itself.
2. **Firebase's `firebaseStorageDownloadTokens` object-metadata convention**
   — a UUID stored as custom metadata on the object, embedded in a URL of
   the form `https://firebasestorage.googleapis.com/v0/b/{bucket}/o/{path}?alt=media&token={token}`.
   The token has no expiry; it stays valid until explicitly rotated
   (overwriting the metadata) or the object is deleted. This is the same
   mechanism the Firebase Console's own "get download URL" button uses.

A URL that expires after 7 days is incompatible with "long-cache immutable"
as PRD §8.7 defines it: a listing published today and still live in six
months would need every image URL silently regenerated before the old ones
expired, which no part of this design (ISR revalidation, the `<img src>`
values baked into rendered HTML, external caches) is built to do, and which
would turn a passive, indefinitely-cacheable asset into one requiring active
lifecycle management for no functional benefit — nothing about the pixels
themselves changes after processing.

## Decision

`FirebaseStorageAdapter.publicUrl(path)` (`src/adapters/firebase/
firebase-storage-adapter.ts`) uses the download-token scheme, not a V4 read
signed URL, for every URL it returns:

- It reads the object's `firebaseStorageDownloadTokens` custom metadata. If
  a token already exists, it reuses it (a `publicUrl()` call is idempotent
  — repeated calls for the same path return the same URL).
- If no token exists yet, it generates one (`randomUUID()`) and writes it to
  the object's metadata before returning the URL — the same lazy-mint-on-
  first-read behaviour the Firebase Console itself exhibits.
- `put()` additionally sets a `public, max-age=31536000, immutable`
  `Cache-Control` header on anything written under a `variants/` path
  segment (`isVariantPath`), so browsers and any CDN in front of the app
  cache the bytes for a year without revalidation — the header does the
  caching work; the token-based URL supplies the "never expires" half PRD
  §8.7 needs.
- `publicUrl()` is called **only** for `variants/` paths. Originals
  (`original/` paths) never get a download token and are never served
  publicly (PRD §8.7 point 3) — the only consumer of an original's bytes is
  `ProcessImage` reading it back server-side via `ImageStorage.get()`.
- `ImageStorage.publicUrl()`'s signature is `Promise<string>` for every
  implementation, not a synchronous string, specifically so a token-based
  scheme (which needs a metadata read, and sometimes a write, per call) and
  a future vendor's differently-shaped scheme can both satisfy the same
  port without special-casing.

V4 signed URLs remain the mechanism for **uploads**
(`createSignedUploadUrl`, PRD §7.4's "short TTL" requirement) — that half
of the ADR-0001 port/adapter split is unaffected; this decision concerns
only the read/public-URL half of `ImageStorage`.

## Consequences

**Positive**

- Meets PRD §8.7 point 3 literally: variant URLs never expire and are safe
  to cache indefinitely, embedded directly in ISR-rendered HTML without any
  refresh mechanism.
- `publicUrl()` is idempotent and cheap after the first call for a given
  path — the token is stored once, not re-derived or re-signed per request.
- The `ImageStorage` port stays vendor-neutral: nothing above the adapter
  (services, routes, UI) knows or cares that the URL contains a Firebase-
  specific token rather than a signature. A future `CloudinaryAdapter`
  implementing the same port and passing the same contract test suite
  (`tests/integration/image-storage.contract.ts`) is the entire swap PRD
  §8.7 point 4 asks for, plus a one-off script rewriting stored
  `property_images.storage_path`-derived URLs if Cloudinary's own URL shape
  differs — no change to `domain/`, `services/`, or any component.
- Originals staying token-free and un-served closes off the one path that
  would otherwise leak a full-resolution, EXIF-stripped-but-otherwise-
  original image publicly before a lister has chosen a cover or reviewed
  the listing.

**Negative / accepted costs**

- The token is a long-lived, unauthenticated bearer credential for that one
  object: anyone who obtains a variant URL (which is by design — it's
  meant to be publicly embeddable) can access that exact image
  indefinitely, including after the listing that used it is later hidden,
  archived, or deleted (deletion removes the object, which does invalidate
  its URL, but hiding does not). This is an accepted trade-off, not a gap:
  PRD §8.7's images are already public-by-design once a listing publishes,
  and no PRD requirement asks for post-publication image access revocation
  independent of deleting the object outright.
- Token rotation (invalidating a previously-issued URL without deleting the
  object) is possible — overwrite the metadata with a fresh token — but
  nothing in this codebase does it; there is no product requirement driving
  it, and adding it later is a same-adapter, same-port change if one
  emerges.
- This scheme is Firebase/GCS-specific plumbing (the metadata key name,
  the `v0/b/{bucket}/o/{path}?alt=media&token=` URL shape) living entirely
  inside `firebase-storage-adapter.ts`; a Cloudinary swap replaces this
  logic wholesale with whatever Cloudinary's own public-URL convention is,
  which is exactly the cost ADR-0001's port/adapter split exists to
  contain to one file.

## Alternatives rejected

- **V4 signed URLs for reads, refreshed periodically.** Would require
  either regenerating every listing's image URLs before the 7-day cap
  expires (a background job with no natural trigger, running forever for
  every published listing, forever) or accepting broken images on stale
  cached pages — both unacceptable against PRD §8.7's "long-cache
  immutable" requirement. Rejected.
- **Make the bucket (or a `variants/`-only prefix) publicly readable via
  GCS IAM, serve plain unsigned `storage.googleapis.com` URLs.** Removes
  the token/signature machinery entirely and is genuinely simpler. Rejected
  because it makes public-readability a bucket-wide (or prefix-wide) IAM
  policy decision made once in the Firebase/GCS console rather than an
  explicit, per-object, application-level decision — the token scheme
  means `publicUrl()` is the only code path that can ever make an object
  reachable without a Google Cloud credential, which is a smaller, more
  auditable surface than a standing IAM grant, and keeps the "originals
  are never public" invariant enforced by which paths the application
  calls `publicUrl()` for, not by which paths happen to sit under a public
  prefix someone has to remember to keep originals out of.
- **A CDN/edge proxy in front of the bucket (e.g. Cloudflare, Vercel's own
  image optimisation) fronting authenticated or signed requests.** Genuine
  future option and not mutually exclusive with this decision — it would
  sit in front of whatever `publicUrl()` returns, not replace it — but is
  additional infrastructure with no PRD requirement driving it at M1's
  10k-listing scale, and the `Cache-Control: immutable` header this ADR's
  decision already sets on every variant does the caching work for browsers
  and any downstream CDN without needing one specifically stood up for M1.
  Deferred, not rejected outright.
