// Vercel entry point for the whole API.
//
// Vercel turns every file inside api/ into its own serverless function, and the free
// Hobby plan allows 12 per project. So the Express app lives in server/ and ships
// through this one file; vercel.json rewrites every /api/* request to it.
import app from '../server/app.js'

export default app
