// An error that already knows which HTTP status it should become. Route handlers
// throw these and errorHandler.js turns them into JSON responses.
export class HttpError extends Error {
  constructor(status, message, details) {
    super(message)
    this.status = status
    this.details = details
  }
}

export const badRequest = (message, details) => new HttpError(400, message, details)
export const unauthorized = (message) => new HttpError(401, message)
export const forbidden = (message) => new HttpError(403, message)
export const notFound = (message) => new HttpError(404, message)
export const conflict = (message, details) => new HttpError(409, message, details)
