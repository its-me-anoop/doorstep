/**
 * runImageStorageContractTests — the ImageStorage contract
 * (src/ports/image-storage.ts's doc comment), PRD §8.7's M1 exit
 * criterion: "contract tests green on the storage adapter". Exercised
 * against two backends, each its own test file:
 *
 *  - tests/integration/image-storage-inmemory.contract.test.ts —
 *    InMemoryImageStorage (tests/support/), always runs, everywhere
 *    (local dev, CI). This is what keeps the contract enforced in CI,
 *    where no live Firebase Storage bucket credential is configured.
 *  - tests/integration/image-storage-firebase.contract.test.ts —
 *    FirebaseStorageAdapter against a real bucket, gated on
 *    TEST_FIREBASE_STORAGE_BUCKET being set — same
 *    describe.skipIf(!process.env.X) pattern this directory's other
 *    "live" suites use (e.g. postcodesio-geocoder.test.ts's
 *    RUN_EXTERNAL_API_TESTS). CI has no such secret, so this half only
 *    ever runs locally, deliberately: PRD §8.8 scopes CI's integration
 *    tier to "service containers", not paid third-party cloud calls.
 *
 * Every object this suite writes lives under a fresh
 * `doorstep-contract-test/{randomUUID()}/...` prefix per test and is
 * always deleted again before the test ends (even on assertion failure,
 * via try/finally), so repeat runs against the real bucket never
 * accumulate garbage.
 *
 * This file is not itself a `*.test.ts` file — it exports a function the
 * two files above call, so vitest's projects.include globs
 * (vitest.config.mts) never pick it up as a suite on its own.
 */

import { randomUUID } from 'node:crypto'
import { describe, expect, it } from 'vitest'

import type { ImageStorage } from '@/ports/image-storage'

export function runImageStorageContractTests(
  name: string,
  factory: () => ImageStorage | Promise<ImageStorage>,
): void {
  describe(`ImageStorage contract: ${name}`, () => {
    it('round-trips put, get, exists and delete', async () => {
      const storage = await factory()
      const path = `doorstep-contract-test/${randomUUID()}/round-trip.bin`
      const bytes = new Uint8Array([9, 8, 7, 6, 5, 4, 3, 2, 1, 0])

      try {
        expect(await storage.exists(path)).toBe(false)

        await storage.put(path, bytes, 'application/octet-stream')

        expect(await storage.exists(path)).toBe(true)
        expect(await storage.get(path)).toEqual(bytes)
      } finally {
        await storage.delete(path)
      }

      expect(await storage.exists(path)).toBe(false)
      expect(await storage.get(path)).toBeNull()
    })

    it('publicUrl serves exactly the stored bytes', async () => {
      const storage = await factory()
      const path = `doorstep-contract-test/${randomUUID()}/public.bin`
      const bytes = new Uint8Array(256)
      for (let i = 0; i < bytes.length; i++) bytes[i] = i

      try {
        await storage.put(path, bytes, 'application/octet-stream')
        const url = await storage.publicUrl(path)
        const response = await fetch(url)

        expect(response.ok).toBe(true)
        expect(new Uint8Array(await response.arrayBuffer())).toEqual(bytes)
      } finally {
        await storage.delete(path)
      }
    })

    it('a signed upload URL accepts a PUT within its constraints, and the object then exists', async () => {
      const storage = await factory()
      const path = `doorstep-contract-test/${randomUUID()}/uploaded.bin`
      const bytes = new Uint8Array(1024).fill(42)
      const contentType = 'application/octet-stream'

      try {
        const signed = await storage.createSignedUploadUrl(path, {
          contentType,
          maxBytes: bytes.length * 4,
          expiresInMs: 5 * 60_000,
        })

        expect(await storage.exists(path)).toBe(false)

        const putResponse = await fetch(signed.url, {
          method: 'PUT',
          headers: { 'Content-Type': contentType, ...signed.headers },
          body: bytes,
        })

        expect(putResponse.ok).toBe(true)
        expect(await storage.exists(path)).toBe(true)
        expect(await storage.get(path)).toEqual(bytes)
      } finally {
        await storage.delete(path)
      }
    })

    describe('unknown paths', () => {
      it('get returns null', async () => {
        const storage = await factory()
        expect(
          await storage.get(`doorstep-contract-test/${randomUUID()}/none.bin`),
        ).toBeNull()
      })

      it('exists returns false', async () => {
        const storage = await factory()
        expect(
          await storage.exists(
            `doorstep-contract-test/${randomUUID()}/none.bin`,
          ),
        ).toBe(false)
      })

      it('delete does not throw', async () => {
        const storage = await factory()
        await expect(
          storage.delete(`doorstep-contract-test/${randomUUID()}/none.bin`),
        ).resolves.toBeUndefined()
      })
    })
  })
}
