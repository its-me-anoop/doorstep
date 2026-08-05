/**
 * validateImageFile — the wizard photo uploader's client-side pre-flight
 * check (M1-DESIGN-SPEC.md §1.5's two named inline error copies: oversize
 * and wrong type), mirroring domain/image-upload-policy.ts's server-side
 * rules rather than redeclaring them, so a file the client accepts is
 * always one RequestImageUpload would also accept. This is a courtesy —
 * saving a round trip and showing the friendlier of the two spec copies
 * before any request fires — not the security boundary: that's still the
 * server (see image-upload-policy.ts's and lib/validation/image.ts's own
 * doc comments).
 */
import {
  isAllowedImageContentType,
  MAX_IMAGE_BYTES,
} from '@/domain/image-upload-policy'

export interface SelectedFile {
  type: string
  size: number
  name: string
}

function formatMegabytes(bytes: number): string {
  return `${(bytes / (1024 * 1024)).toFixed(1)}MB`
}

/** Returns the spec's exact inline error copy, or `null` when the file is
 * fine to upload. Type is checked before size — a wrong-type file that's
 * also oversize gets the more fundamental "not a photo" message. */
export function validateImageFile(file: SelectedFile): string | null {
  if (!isAllowedImageContentType(file.type)) {
    return "That file isn't a photo Doorstep can use — try a JPEG or PNG."
  }
  if (file.size > MAX_IMAGE_BYTES) {
    return `This photo's too big — Doorstep accepts up to 15MB, this one's ${formatMegabytes(file.size)}.`
  }
  return null
}
