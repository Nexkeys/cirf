import { resolve } from 'node:path'
import { pathToFileURL } from 'node:url'
import react from '@vitejs/plugin-react'
import { defineConfig, loadEnv } from 'vite'

// `npm run dev` serves the API as well: the Express app from server/app.js answers /api
// inside Vite's dev server, so one command runs the whole site. Changes under server/
// need a restart. To run the API on its own instead (`npm run dev:api`, which restarts
// itself on changes), set API_PROXY_TARGET=http://localhost:3001 and /api is proxied there.
function cirfApi(env) {
  return {
    name: 'cirf-api',
    apply: 'serve',
    async configureServer(server) {
      if (env.API_PROXY_TARGET) return
      // The API reads its settings (Firebase service account, Cloudinary) from process.env.
      for (const [key, value] of Object.entries(env)) process.env[key] ??= value
      // A variable path, so Vite loads the server as it is instead of bundling it into the config.
      const appPath = pathToFileURL(resolve('server/app.js')).href
      const { default: app } = await import(appPath)
      server.middlewares.use((req, res, next) => (req.url.startsWith('/api/') ? app(req, res, next) : next()))
    },
  }
}

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
    plugins: [react(), cirfApi(env)],
    define: { __FIREBASE_CONFIG__: JSON.stringify(firebaseConfig) },
    server: env.API_PROXY_TARGET ? { proxy: { '/api': env.API_PROXY_TARGET } } : {},
  }
})
