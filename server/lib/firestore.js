import { Timestamp } from 'firebase-admin/firestore'

// Firestore returns dates as Timestamp objects, which don't turn into readable JSON.
// Convert them to ISO strings (recursively) before anything leaves the API.
export function toJson(value) {
  if (value instanceof Timestamp) return value.toDate().toISOString()
  if (Array.isArray(value)) return value.map(toJson)
  if (value && typeof value === 'object') {
    return Object.fromEntries(Object.entries(value).map(([key, inner]) => [key, toJson(inner)]))
  }
  return value
}

// A document snapshot as a plain object with its id included.
export const docToJson = (snapshot) => toJson({ id: snapshot.id, ...snapshot.data() })

// Newest first, for lists we sort in memory. Sorting here instead of with orderBy()
// avoids needing composite indexes in Firestore for every filter + sort combination.
export const newestFirst = (field) => (a, b) => (b[field] ?? '').localeCompare(a[field] ?? '')
export const oldestFirst = (field) => (a, b) => (a[field] ?? '').localeCompare(b[field] ?? '')
