import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { normalizePhone } from './phone.js'

describe('normalizePhone', () => {
  it('writes every usual form of a Nigerian number the same way', () => {
    for (const input of ['08012345678', '0801 234 5678', '(0801) 234-5678', '2348012345678', '+234 801 234 5678']) {
      assert.equal(normalizePhone(input), '+2348012345678', input)
    }
  })

  it('keeps international numbers that already have a country code', () => {
    assert.equal(normalizePhone('+44 7700 900123'), '+447700900123')
  })

  it('rejects things that are not phone numbers', () => {
    for (const input of ['', '12345', '0801234567', '080123456789', '+2340801234567', 'call me', null]) {
      assert.equal(normalizePhone(input), null, String(input))
    }
  })
})
