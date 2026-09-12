import { initializeApp } from 'firebase/app'
import {
  browserLocalPersistence,
  browserSessionPersistence,
  connectAuthEmulator,
  getAuth,
  GoogleAuthProvider,
  setPersistence,
} from 'firebase/auth'

// Only Firebase Auth runs in the browser. Every piece of CIRF data goes through the API
// (src/lib/api.js), never straight to Firestore. The config is public and comes from
// vite.config.js.
const config = __FIREBASE_CONFIG__

if (!config.apiKey || !config.authDomain || !config.projectId) {
  throw new Error(
    'Firebase web config is missing. Set FIREBASE_API_KEY, FIREBASE_AUTH_DOMAIN, FIREBASE_PROJECT_ID ' +
      'and FIREBASE_APP_ID (see .env.example), then restart Vite.',
  )
}

export const auth = getAuth(initializeApp(config))

// Local testing against the Firebase emulators, so practice accounts never reach the
// real project. See "Trying the app on the emulators" in server/README.md.
if (import.meta.env.VITE_AUTH_EMULATOR_URL) {
  connectAuthEmulator(auth, import.meta.env.VITE_AUTH_EMULATOR_URL, { disableWarnings: true })
}

export const googleProvider = new GoogleAuthProvider()
googleProvider.setCustomParameters({ prompt: 'select_account' })

// "Remember me": stay signed in after the browser closes, or only while this tab is open.
export const rememberSession = (remember) =>
  setPersistence(auth, remember ? browserLocalPersistence : browserSessionPersistence)
