import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { readPrivateKey } from './privateKey.js'

const KEY = '-----BEGIN PRIVATE KEY-----\nMIIEabc\ndef==\n-----END PRIVATE KEY-----\n'

describe('readPrivateKey', () => {
  it('accepts the key with real line breaks or with \\n written out', () => {
    assert.equal(readPrivateKey(KEY), KEY)
    assert.equal(readPrivateKey(KEY.replace(/\n/g, '\\n')), KEY)
    assert.equal(readPrivateKey(KEY.replace(/\n/g, '\r\n')), KEY)
  })

  it('drops the quote marks copied from the JSON file', () => {
    assert.equal(readPrivateKey(`"${KEY.replace(/\n/g, '\\n')}",`), KEY)
  })

  it('takes the key out of a whole pasted service account JSON', () => {
    assert.equal(readPrivateKey(JSON.stringify({ type: 'service_account', private_key: KEY })), KEY)
  })

  it('explains an incomplete key without echoing it', () => {
    assert.throws(() => readPrivateKey('MIIEabc'), (error) => !error.message.includes('MIIEabc') && /not a complete/.test(error.message))
  })
})
