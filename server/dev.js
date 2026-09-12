// Local development server, started with `npm run dev:api`. Vite proxies /api here
// (see vite.config.js). On Vercel, api/index.js is used instead and this never runs.
import app from './app.js'

const port = Number(process.env.API_PORT ?? 3001)

app.listen(port, () => {
  console.log(`CIRF API listening on http://localhost:${port}/api`)
})
