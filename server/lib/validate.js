import { badRequest } from './httpError.js'

// Checks request input against a zod schema. Returns the cleaned data, or throws a
// 400 listing every field that failed so the client can show it next to the input.
export function parse(schema, input) {
  const result = schema.safeParse(input ?? {})
  if (!result.success) {
    throw badRequest(
      'Some fields are missing or invalid',
      result.error.issues.map((issue) => ({ field: issue.path.join('.'), message: issue.message })),
    )
  }
  return result.data
}
