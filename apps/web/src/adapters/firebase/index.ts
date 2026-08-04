/**
 * adapters/firebase/
 *
 * Firebase Auth (session cookie verification, custom claims) and
 * Firebase Storage, the latter implementing ImageStorage (ports/). See
 * PRD §8.4, §8.7.
 *
 * Storage (ImageStorage) is not implemented yet — only Auth lands this
 * commit.
 */

export { getAdminApp } from './admin-app'
export { FirebaseAuthGateway, toDecodedIdentity } from './firebase-auth-gateway'
