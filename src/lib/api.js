import { auth } from './firebase.js'

// On Vercel the app and the API share one domain, so this is normally empty.
const BASE_URL = import.meta.env.VITE_API_BASE_URL ?? ''

// An error response from the API: { error: { message, code?, details? } }
export class ApiError extends Error {
  constructor(status, message, code, details) {
    super(message)
    this.status = status
    this.code = code
    this.details = details ?? []
  }

  // The API's message for one form field, if validation failed on it.
  fieldMessage(field) {
    return this.details.find((detail) => detail.field === field)?.message
  }
}

// Calls the CIRF API, sending the signed-in user's Firebase ID token.
// Pass signedIn: false for public routes like phone sign-in and estate search.
export async function api(path, { method = 'GET', body, signedIn = true } = {}) {
  const headers = {}
  if (body !== undefined) headers['content-type'] = 'application/json'
  if (signedIn && auth.currentUser) headers.authorization = `Bearer ${await auth.currentUser.getIdToken()}`

  let response
  try {
    response = await fetch(`${BASE_URL}/api${path}`, {
      method,
      headers,
      body: body === undefined ? undefined : JSON.stringify(body),
    })
  } catch {
    throw new ApiError(0, "Can't reach CIRF right now. Check your connection and try again.")
  }

  if (response.status === 204) return null
  const data = await response.json().catch(() => null)
  if (!response.ok) {
    const error = data?.error ?? {}
    throw new ApiError(
      response.status,
      error.message ?? 'Something went wrong on our side, please try again',
      error.code,
      error.details,
    )
  }
  return data
}
