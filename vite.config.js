import react from '@vitejs/plugin-react'
import { defineConfig, loadEnv } from 'vite'

// https://vite.dev/config/
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '')

  // The Firebase web config is public by design: it only tells the browser which project
  // to sign in to. Exactly these four values are passed to the app. envPrefix is left
  // alone on purpose, because widening it to FIREBASE_ would also bundle
  // FIREBASE_PRIVATE_KEY and FIREBASE_CLIENT_EMAIL into public JavaScript.
  const firebaseConfig = {
    apiKey: env.VITE_FIREBASE_API_KEY || env.FIREBASE_API_KEY,
    authDomain: env.VITE_FIREBASE_AUTH_DOMAIN || env.FIREBASE_AUTH_DOMAIN,
    projectId: env.VITE_FIREBASE_PROJECT_ID || env.FIREBASE_PROJECT_ID,
    appId: env.VITE_FIREBASE_APP_ID || env.FIREBASE_APP_ID,
  }

  return {
    plugins: [react()],
    define: { __FIREBASE_CONFIG__: JSON.stringify(firebaseConfig) },
    server: {
      // Locally the API runs as its own process (npm run dev:api).
      proxy: { '/api': env.API_PROXY_TARGET || 'http://localhost:3001' },
    },
  }
})
