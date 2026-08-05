import { describe, expect, it } from 'vitest'

import {
  buildDownloadUrl,
  isVariantPath,
  resolveStorageBucket,
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
})
