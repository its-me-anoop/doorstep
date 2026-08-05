import { describe, expect, it } from 'vitest'

import { normalizePrivateKey } from '@/adapters/firebase/admin-app'

const BODY_64 = 'A'.repeat(64)
const BODY_TAIL = 'B'.repeat(20)
const PEM = `-----BEGIN PRIVATE KEY-----\n${BODY_64}\n${BODY_TAIL}\n-----END PRIVATE KEY-----\n`

describe('normalizePrivateKey', () => {
  it('passes a clean multi-line PEM through unchanged', () => {
    expect(normalizePrivateKey(PEM)).toBe(PEM)
  })

  it('repairs newlines collapsed into spaces (terminal copy-paste)', () => {
    const collapsed = `-----BEGIN PRIVATE KEY----- ${BODY_64} ${BODY_TAIL} -----END PRIVATE KEY-----`
    expect(normalizePrivateKey(collapsed)).toBe(PEM)
  })

  it('rewraps arbitrary line lengths to canonical 64 columns', () => {
    const weird = `-----BEGIN PRIVATE KEY-----\n${BODY_64.slice(0, 10)}\n${BODY_64.slice(10)}${BODY_TAIL}\n-----END PRIVATE KEY-----`
    expect(normalizePrivateKey(weird)).toBe(PEM)
  })

  it('unescapes single-line \\n-escaped values (env-var style)', () => {
    const escaped = PEM.replace(/\n/g, '\\n')
    expect(normalizePrivateKey(escaped)).toBe(PEM)
  })

  it('strips wrapping double quotes copied from JSON or .env files', () => {
    const quoted = '"' + PEM.replace(/\n/g, '\\n') + '"'
    expect(normalizePrivateKey(quoted)).toBe(PEM)
  })

  it('strips wrapping single quotes', () => {
    const quoted = "'" + PEM.replace(/\n/g, '\\n') + "'"
    expect(normalizePrivateKey(quoted)).toBe(PEM)
  })

  it('trims surrounding whitespace before unwrapping', () => {
    const messy = '  "' + PEM.replace(/\n/g, '\\n') + '"\n'
    expect(normalizePrivateKey(messy)).toBe(PEM)
  })
})
