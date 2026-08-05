import { describe, expect, it } from 'vitest'

import { normalizePrivateKey } from '@/adapters/firebase/admin-app'

const PEM = '-----BEGIN PRIVATE KEY-----\nabc\ndef\n-----END PRIVATE KEY-----\n'

describe('normalizePrivateKey', () => {
  it('passes a clean multi-line PEM through unchanged', () => {
    expect(normalizePrivateKey(PEM)).toBe(PEM)
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
