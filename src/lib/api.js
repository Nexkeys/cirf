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
  if (!response.ok && !data && response.status >= 502) {
    // No JSON at all: the API itself isn't running or a gateway couldn't reach it.
    throw new ApiError(response.status, "CIRF's server isn't responding right now. Please try again in a moment.")
  }
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

// Uploads an image through POST /api/uploads/image (Cloudinary) and returns its URL.
// `purpose` files it under campaign, contribution-proof, receipt or quote.
export async function uploadImage(file, purpose) {
  const form = new FormData()
  form.append('file', file)
  form.append('purpose', purpose)

  let response
  try {
    response = await fetch(`${BASE_URL}/api/uploads/image`, {
      method: 'POST',
      headers: auth.currentUser ? { authorization: `Bearer ${await auth.currentUser.getIdToken()}` } : {},
      body: form,
    })
  } catch {
    throw new ApiError(0, "Can't reach CIRF right now. Check your connection and try again.")
  }
  const data = await response.json().catch(() => null)
  if (!response.ok) throw new ApiError(response.status, data?.error?.message ?? 'The image could not be uploaded')
  return data.url
}

// Downloads a file the API only serves to signed-in people (like a PDF report). A plain
// link can't send the sign-in token, so fetch it and save it from memory.
export async function downloadFile(path, filename) {
  const headers = auth.currentUser ? { authorization: `Bearer ${await auth.currentUser.getIdToken()}` } : {}
  const response = await fetch(`${BASE_URL}/api${path}`, { headers }).catch(() => null)
  if (!response?.ok) throw new ApiError(response?.status ?? 0, 'The file could not be downloaded. Please try again.')
  const url = URL.createObjectURL(await response.blob())
  const link = Object.assign(document.createElement('a'), { href: url, download: filename })
  document.body.append(link)
  link.click()
  link.remove()
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}
