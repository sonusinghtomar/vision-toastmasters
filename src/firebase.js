import { initializeApp } from 'firebase/app'
import { getAuth, connectAuthEmulator } from 'firebase/auth'
import {
  initializeFirestore,
  persistentLocalCache,
  persistentMultipleTabManager,
  connectFirestoreEmulator,
} from 'firebase/firestore'
import { firebaseConfig, isConfigured, useEmulators } from './config'

export const app = isConfigured ? initializeApp(firebaseConfig) : null
export const auth = app ? getAuth(app) : null
// Persistent cache lets the app read and queue writes while offline.
export const db = app
  ? initializeFirestore(app, {
      localCache: persistentLocalCache({ tabManager: persistentMultipleTabManager() }),
      // Skip empty (undefined) fields instead of failing the whole save.
      ignoreUndefinedProperties: true,
    })
  : null

if (app && useEmulators) {
  connectAuthEmulator(auth, 'http://127.0.0.1:9099', { disableWarnings: true })
  connectFirestoreEmulator(db, '127.0.0.1', 8080)
}
