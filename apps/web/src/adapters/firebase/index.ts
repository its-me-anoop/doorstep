/**
 * adapters/firebase/
 *
 * Firebase Auth (session cookie verification, custom claims) and
 * Firebase Storage, the latter implementing ImageStorage (ports/). See
 * PRD §8.4, §8.7.
 */

export { getAdminApp } from './admin-app'
export { FirebaseAuthGateway, toDecodedIdentity } from './firebase-auth-gateway'
export {
  FirebaseStorageAdapter,
  resolveStorageBucket,
  isVariantPath,
  buildDownloadUrl,
} from './firebase-storage-adapter'
