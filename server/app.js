import express from 'express'
import { errorHandler, notFoundHandler } from './middleware/errorHandler.js'
import campaigns from './routes/campaigns.js'
import contributions from './routes/contributions.js'
import estates from './routes/estates.js'
import notifications from './routes/notifications.js'
import publicRoutes from './routes/public.js'
import reconciliation from './routes/reconciliation.js'
import uploads from './routes/uploads.js'
import users from './routes/users.js'
import vendorQuotes from './routes/vendorQuotes.js'

// The whole CIRF API as one Express app. Runs locally through server/dev.js and on
// Vercel through api/index.js. It returns plain JSON and knows nothing about React,
// so a React Native app can use exactly the same endpoints later.

const app = express()

app.disable('x-powered-by')
app.use(express.json({ limit: '100kb' }))

app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', time: new Date().toISOString() })
})

// Each router declares its full paths (e.g. /campaigns/:id/contributions), grouped by
// resource the same way as the API spec.
for (const router of [users, estates, campaigns, contributions, vendorQuotes, reconciliation, notifications, uploads, publicRoutes]) {
  app.use('/api', router)
}

app.use('/api', notFoundHandler)
app.use(errorHandler)

export default app
