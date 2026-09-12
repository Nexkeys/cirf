// An error that already knows which HTTP status it should become. Route handlers
// throw these and errorHandler.js turns them into JSON responses.
//
// `code` is an optional fixed reason such as NOT_REGISTERED, for the few cases where the
// app has to do something different (open a screen), not just show the message.
export class HttpError extends Error {
  constructor(status, message, details, code) {
    super(message)
    this.status = status
    this.details = details
    this.code = code
  }
}

export const badRequest = (message, details) => new HttpError(400, message, details)
export const unauthorized = (message, code) => new HttpError(401, message, undefined, code)
export const forbidden = (message, code) => new HttpError(403, message, undefined, code)
export const notFound = (message) => new HttpError(404, message)
export const conflict = (message, details) => new HttpError(409, message, details)
export const tooManyRequests = (message) => new HttpError(429, message)
