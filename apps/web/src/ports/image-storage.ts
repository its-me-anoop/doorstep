/**
 * ImageStorage — fronts Firebase Storage today; a future CloudinaryAdapter
 * must satisfy this same contract (LSP) so the wizard and image pipeline
 * never know which vendor is behind it. See PRD §8.7.
 */

export interface SignedUploadUrl {
  uploadUrl: string
  storagePath: string
  expiresAt: Date
}

export interface ImageStorage {
  createSignedUploadUrl(params: {
    propertyId: string
    contentType: string
    maxSizeBytes: number
  }): Promise<SignedUploadUrl>
  getPublicUrl(storagePath: string): string
  delete(storagePath: string): Promise<void>
}
