import { MulterError } from 'multer'
import { HttpError } from '../lib/httpError.js'

// Every error response has the same shape: { error: { message, code?, details? } }

export function notFoundHandler(req, res) {
  res.status(404).json({ error: { message: `No API route for ${req.method} ${req.path}` } })
}

// Express 5 forwards errors thrown in async handlers here automatically.
export function errorHandler(err, req, res, next) {
  if (res.headersSent) return next(err)

  if (err instanceof HttpError) {
    return res.status(err.status).json({ error: { message: err.message, code: err.code, details: err.details } })
  }

  if (err instanceof MulterError) {
    const message = err.code === 'LIMIT_FILE_SIZE' ? 'That file is too large (max 4 MB)' : err.message
    return res.status(400).json({ error: { message } })
  }

  // Malformed JSON bodies and similar client mistakes from Express's own parsers.
  if (err.expose && err.status >= 400 && err.status < 500) {
    return res.status(err.status).json({ error: { message: err.message } })
  }

  console.error(err)
  res.status(500).json({ error: { message: 'Something went wrong on our side, please try again' } })
}
