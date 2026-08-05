import { describe, expect, it } from 'vitest'

import { validateImageFile } from '@/lib/image-file-validation'
import { MAX_IMAGE_BYTES } from '@/domain/image-upload-policy'

describe('validateImageFile', () => {
  it('accepts an allowed content type within the size ceiling', () => {
    expect(
      validateImageFile({ type: 'image/jpeg', size: 1024, name: 'a.jpg' }),
    ).toBeNull()
  })

  it.each(['image/jpeg', 'image/png', 'image/webp', 'image/heic'])(
    'accepts %s',
    (type) => {
      expect(validateImageFile({ type, size: 1024, name: 'a' })).toBeNull()
    },
  )

  it('rejects a disallowed content type with the exact spec copy', () => {
    expect(
      validateImageFile({ type: 'image/gif', size: 1024, name: 'a.gif' }),
    ).toBe("That file isn't a photo Doorstep can use — try a JPEG or PNG.")
  })

  it('rejects a file over the 15MB ceiling with the exact spec copy, showing the size in MB', () => {
    expect(
      validateImageFile({
        type: 'image/jpeg',
        size: MAX_IMAGE_BYTES + 1024 * 1024,
        name: 'huge.jpg',
      }),
    ).toBe(
      "This photo's too big — Doorstep accepts up to 15MB, this one's 16.0MB.",
    )
  })

  it('accepts a file exactly at the size ceiling', () => {
    expect(
      validateImageFile({
        type: 'image/jpeg',
        size: MAX_IMAGE_BYTES,
        name: 'a.jpg',
      }),
    ).toBeNull()
  })

  it('checks type before size, so an oversized wrong-type file gets the type message', () => {
    expect(
      validateImageFile({
        type: 'image/gif',
        size: MAX_IMAGE_BYTES + 1,
        name: 'a.gif',
      }),
    ).toBe("That file isn't a photo Doorstep can use — try a JPEG or PNG.")
  })
})
