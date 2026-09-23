// The service account private key as pasted into Vercel, in whichever of the usual
// shapes it arrives: with real line breaks, with "\n" written out, still wrapped in the
// quote marks it has inside the JSON file, or as the whole service account JSON.
// Errors describe what's wrong with the shape, never the value.
export function readPrivateKey(raw) {
  let key = raw.trim()

  if (key.startsWith('{')) {
    try {
      key = JSON.parse(key).private_key ?? ''
    } catch {
      throw new Error('FIREBASE_PRIVATE_KEY looks like JSON but could not be read. Paste only the private_key value.')
    }
  }

  key = key
    .replace(/^["']|["'],?$/g, '') // quote marks copied along with the value
    .replace(/\\n/g, '\n') // "\n" written out instead of line breaks
    .replace(/\r/g, '')
    .trim()

  if (!key.startsWith('-----BEGIN PRIVATE KEY-----') || !key.endsWith('-----END PRIVATE KEY-----')) {
    throw new Error(
      'FIREBASE_PRIVATE_KEY is not a complete private key. Paste the private_key value from the service account ' +
        'JSON, from -----BEGIN PRIVATE KEY----- through -----END PRIVATE KEY-----.',
    )
  }
  return `${key}\n`
}
