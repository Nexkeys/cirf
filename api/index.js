// Vercel entry point for the whole API.
//
// Vercel turns every file inside api/ into its own serverless function, and the free
// Hobby plan allows 12 per project. So the Express app lives in server/ and ships
// through this one file; vercel.json rewrites every /api/* request to it.
//
// If the server can't start (say a Firebase variable is missing or pasted wrongly),
// Vercel would only show "FUNCTION_INVOCATION_FAILED". Instead every request, including
// /api/health, answers with the reason, so the problem can be fixed from the message.
// Error messages from the Firebase SDK name the setting at fault, never its value.
let handler

try {
  handler = (await import('../server/app.js')).default
} catch (error) {
  console.error('CIRF API failed to start:', error)
  const reason = String(error?.message ?? error).slice(0, 300)
  handler = (req, res) => {
    res.statusCode = 503
    res.setHeader('content-type', 'application/json')
    res.end(JSON.stringify({ error: { message: `The CIRF server could not start: ${reason}`, code: 'SERVER_NOT_CONFIGURED' } }))
  }
}

export default handler
