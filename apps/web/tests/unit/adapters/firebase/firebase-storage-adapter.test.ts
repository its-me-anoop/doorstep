import { describe, expect, it } from 'vitest'

import {
  buildDownloadUrl,
  buildEmulatorUploadUrl,
  isVariantPath,
  resolveStorageBucket,
  resolveStorageEmulatorHost,
} from '@/adapters/firebase/firebase-storage-adapter'

describe('resolveStorageBucket', () => {
  it('reads FIREBASE_STORAGE_BUCKET from the given env', () => {
    expect(
      resolveStorageBucket({
        FIREBASE_STORAGE_BUCKET: 'my-shop-cdeac.firebasestorage.app',
      }),
    ).toBe('my-shop-cdeac.firebasestorage.app')
  })

  it('throws a message telling the operator what to set when missing', () => {
    expect(() => resolveStorageBucket({})).toThrow(/FIREBASE_STORAGE_BUCKET/)
  })
})

describe('isVariantPath', () => {
  it('is true for a variants/ path', () => {
    expect(isVariantPath('listings/prop-1/variants/img-1/800.webp')).toBe(true)
  })

  it('is false for an original/ path', () => {
    expect(isVariantPath('listings/prop-1/original/img-1')).toBe(false)
  })
})

describe('buildDownloadUrl', () => {
  it('matches the firebaseStorageDownloadTokens URL shape', () => {
    const url = buildDownloadUrl(
      'my-shop-cdeac.firebasestorage.app',
      'listings/prop-1/variants/img-1/800.webp',
      'token-abc-123',
    )

    expect(url).toBe(
      'https://firebasestorage.googleapis.com/v0/b/my-shop-cdeac.firebasestorage.app/o/' +
        'listings%2Fprop-1%2Fvariants%2Fimg-1%2F800.webp?alt=media&token=token-abc-123',
    )
  })

  it('URL-encodes path separators and special characters', () => {
    const url = buildDownloadUrl('bucket', 'a b/c#d', 'tok')
    expect(url).toContain('a%20b%2Fc%23d')
  })

  it('uses a supplied base URL instead of the production endpoint — the Storage emulator branch', () => {
    const url = buildDownloadUrl(
      'my-shop-cdeac.firebasestorage.app',
      'listings/prop-1/variants/img-1/800.webp',
      'token-abc-123',
      'http://127.0.0.1:9199/v0',
    )

    expect(url).toBe(
      'http://127.0.0.1:9199/v0/b/my-shop-cdeac.firebasestorage.app/o/' +
        'listings%2Fprop-1%2Fvariants%2Fimg-1%2F800.webp?alt=media&token=token-abc-123',
    )
  })
})

describe('resolveStorageEmulatorHost', () => {
  it('reads FIREBASE_STORAGE_EMULATOR_HOST', () => {
    expect(
      resolveStorageEmulatorHost({
        FIREBASE_STORAGE_EMULATOR_HOST: '127.0.0.1:9199',
      }),
    ).toBe('127.0.0.1:9199')
  })

  it('reads STORAGE_EMULATOR_HOST', () => {
    expect(
      resolveStorageEmulatorHost({ STORAGE_EMULATOR_HOST: '127.0.0.1:9199' }),
    ).toBe('127.0.0.1:9199')
  })

  it('prefers STORAGE_EMULATOR_HOST when both are set — the same precedence firebase-admin/storage itself applies', () => {
    expect(
      resolveStorageEmulatorHost({
        FIREBASE_STORAGE_EMULATOR_HOST: 'from-firebase-var:9199',
        STORAGE_EMULATOR_HOST: 'from-gcs-var:9199',
      }),
    ).toBe('from-gcs-var:9199')
  })

  it('strips an http(s):// prefix — STORAGE_EMULATOR_HOST may already carry one', () => {
    expect(
      resolveStorageEmulatorHost({
        STORAGE_EMULATOR_HOST: 'http://127.0.0.1:9199',
      }),
    ).toBe('127.0.0.1:9199')
  })

  it('returns undefined when neither is set', () => {
    expect(resolveStorageEmulatorHost({})).toBeUndefined()
  })
})

describe('buildEmulatorUploadUrl', () => {
  it('matches the Storage emulator’s /v0 one-shot upload endpoint shape', () => {
    const url = buildEmulatorUploadUrl(
      '127.0.0.1:9199',
      'my-shop-cdeac.firebasestorage.app',
      'listings/prop-1/original/img-1',
    )

    expect(url).toBe(
      'http://127.0.0.1:9199/v0/b/my-shop-cdeac.firebasestorage.app/o/' +
        'listings%2Fprop-1%2Foriginal%2Fimg-1',
    )
  })

  it('URL-encodes path separators and special characters', () => {
    const url = buildEmulatorUploadUrl('127.0.0.1:9199', 'bucket', 'a b/c#d')
    expect(url).toContain('a%20b%2Fc%23d')
  })
})
