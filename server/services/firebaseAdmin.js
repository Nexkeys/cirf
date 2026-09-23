// Firebase Admin SDK setup. This is the only way CIRF talks to Firestore and checks
// Firebase Auth tokens. The service account key stays on the server, never in the
// browser bundle.
//
// Credentials are read from, in order:
//   1. The Firebase emulators, when FIRESTORE_EMULATOR_HOST is set (tests)
//   2. FIREBASE_CLIENT_EMAIL + FIREBASE_PRIVATE_KEY (Vercel)
//   3. FIREBASE_SERVICE_ACCOUNT_PATH pointing at the downloaded JSON key (local dev)
import { readFileSync } from 'node:fs'
import { cert, getApps, initializeApp } from 'firebase-admin/app'
import { getAuth } from 'firebase-admin/auth'
import { getFirestore } from 'firebase-admin/firestore'
import { readPrivateKey } from '../lib/privateKey.js'

function appOptions() {
  const {
    FIRESTORE_EMULATOR_HOST,
    FIREBASE_PROJECT_ID,
    FIREBASE_CLIENT_EMAIL,
    FIREBASE_PRIVATE_KEY,
    FIREBASE_SERVICE_ACCOUNT_PATH,
  } = process.env

  // The emulators accept any project id and need no credentials.
  if (FIRESTORE_EMULATOR_HOST) return { projectId: FIREBASE_PROJECT_ID ?? 'demo-cirf' }

  if (FIREBASE_CLIENT_EMAIL && FIREBASE_PRIVATE_KEY) {
    return {
      credential: cert({
        projectId: FIREBASE_PROJECT_ID,
        clientEmail: FIREBASE_CLIENT_EMAIL,
        privateKey: readPrivateKey(FIREBASE_PRIVATE_KEY),
      }),
    }
  }

  if (FIREBASE_SERVICE_ACCOUNT_PATH) {
    return { credential: cert(JSON.parse(readFileSync(FIREBASE_SERVICE_ACCOUNT_PATH, 'utf8'))) }
  }

  throw new Error(
    'Firebase Admin credentials are missing. Set FIREBASE_CLIENT_EMAIL and FIREBASE_PRIVATE_KEY, ' +
      'or FIREBASE_SERVICE_ACCOUNT_PATH for local development.',
  )
}

const app = getApps()[0] ?? initializeApp(appOptions())

export const auth = getAuth(app)
export const db = getFirestore(app)
