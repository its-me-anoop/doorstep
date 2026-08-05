import { describe, expect, it } from 'vitest'

import { resolveServiceAccount } from '@/adapters/firebase/admin-app'

const PEM = `-----BEGIN PRIVATE KEY-----\n${'A'.repeat(64)}\n-----END PRIVATE KEY-----\n`

const ACCOUNT_JSON = JSON.stringify({
  type: 'service_account',
  project_id: 'doorstep-test',
  client_email: 'sdk@doorstep-test.iam.gserviceaccount.com',
  private_key: PEM,
})

describe('resolveServiceAccount', () => {
  it('prefers FIREBASE_SERVICE_ACCOUNT_B64 when set (paste-proof single line)', () => {
    const env = {
      FIREBASE_SERVICE_ACCOUNT_B64:
        Buffer.from(ACCOUNT_JSON).toString('base64'),
      FIREBASE_PROJECT_ID: 'ignored',
      FIREBASE_CLIENT_EMAIL: 'ignored@x.com',
      FIREBASE_PRIVATE_KEY: 'ignored',
    }
    expect(resolveServiceAccount(env)).toEqual({
      projectId: 'doorstep-test',
      clientEmail: 'sdk@doorstep-test.iam.gserviceaccount.com',
      privateKey: PEM,
    })
  })

  it('normalises the private key inside the decoded JSON too', () => {
    const collapsed = JSON.stringify({
      project_id: 'doorstep-test',
      client_email: 'sdk@doorstep-test.iam.gserviceaccount.com',
      private_key: PEM.replace(/\n/g, ' '),
    })
    const env = {
      FIREBASE_SERVICE_ACCOUNT_B64: Buffer.from(collapsed).toString('base64'),
    }
    expect(resolveServiceAccount(env).privateKey).toBe(PEM)
  })

  it('falls back to the three separate variables when B64 is unset', () => {
    const env = {
      FIREBASE_PROJECT_ID: 'doorstep-test',
      FIREBASE_CLIENT_EMAIL: 'sdk@doorstep-test.iam.gserviceaccount.com',
      FIREBASE_PRIVATE_KEY: PEM.replace(/\n/g, '\\n'),
    }
    expect(resolveServiceAccount(env)).toEqual({
      projectId: 'doorstep-test',
      clientEmail: 'sdk@doorstep-test.iam.gserviceaccount.com',
      privateKey: PEM,
    })
  })

  it('throws a clear error when the B64 value is not valid base64 JSON', () => {
    expect(() =>
      resolveServiceAccount({ FIREBASE_SERVICE_ACCOUNT_B64: '!!!not-b64!!!' }),
    ).toThrowError(/FIREBASE_SERVICE_ACCOUNT_B64/)
  })

  it('throws when a required field is missing from the decoded JSON', () => {
    const partial = JSON.stringify({ project_id: 'doorstep-test' })
    expect(() =>
      resolveServiceAccount({
        FIREBASE_SERVICE_ACCOUNT_B64: Buffer.from(partial).toString('base64'),
      }),
    ).toThrowError(/client_email|private_key/)
  })
})
