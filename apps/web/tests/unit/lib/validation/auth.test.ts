import { describe, expect, it } from 'vitest'

import { signInSchema, signUpSchema } from '@/lib/validation/auth'

function issueMessage(result: {
  success: boolean
  error?: { issues: { message: string }[] }
}) {
  return result.error?.issues[0]?.message
}

describe('signUpSchema', () => {
  const valid = {
    fullName: 'Sarah Cole',
    email: 'sarah@example.com',
    password: 'goodpassword',
    consent: true,
  }

  it('accepts a fully valid submission', () => {
    expect(signUpSchema.safeParse(valid).success).toBe(true)
  })

  it('requires a name with the imperative, human copy', () => {
    const result = signUpSchema.safeParse({ ...valid, fullName: '' })
    expect(result.success).toBe(false)
    expect(issueMessage(result)).toBe('Enter your name.')
  })

  it('treats a whitespace-only name as empty', () => {
    const result = signUpSchema.safeParse({ ...valid, fullName: '   ' })
    expect(result.success).toBe(false)
  })

  it('requires an email with the imperative copy when empty', () => {
    const result = signUpSchema.safeParse({ ...valid, email: '' })
    expect(issueMessage(result)).toBe('Enter your email address.')
  })

  it('rejects a malformed email with the typo-check copy', () => {
    const result = signUpSchema.safeParse({ ...valid, email: 'not-an-email' })
    expect(issueMessage(result)).toBe(
      "That email address doesn't look quite right — check for typos.",
    )
  })

  it('requires a password when empty', () => {
    const result = signUpSchema.safeParse({ ...valid, password: '' })
    expect(issueMessage(result)).toBe('Enter a password.')
  })

  it('rejects a password under 8 characters with the spec copy', () => {
    const result = signUpSchema.safeParse({ ...valid, password: 'short1' })
    expect(issueMessage(result)).toBe(
      'Your password needs at least 8 characters.',
    )
  })

  it('rejects an unticked consent checkbox', () => {
    const result = signUpSchema.safeParse({ ...valid, consent: false })
    expect(result.success).toBe(false)
  })
})

describe('signInSchema', () => {
  it('accepts a valid email and non-empty password', () => {
    const result = signInSchema.safeParse({
      email: 'sarah@example.com',
      password: 'whatever-it-is',
    })
    expect(result.success).toBe(true)
  })

  it('requires an email with the imperative copy when empty', () => {
    const result = signInSchema.safeParse({ email: '', password: 'x' })
    expect(issueMessage(result)).toBe('Enter your email address.')
  })

  it('rejects a malformed email with the typo-check copy', () => {
    const result = signInSchema.safeParse({
      email: 'not-an-email',
      password: 'x',
    })
    expect(issueMessage(result)).toBe(
      "That email address doesn't look quite right — check for typos.",
    )
  })

  it('requires a password when empty, without a strength requirement', () => {
    const result = signInSchema.safeParse({
      email: 'sarah@example.com',
      password: '',
    })
    expect(issueMessage(result)).toBe('Enter your password.')
  })

  it('does not enforce an 8-character minimum on sign-in', () => {
    const result = signInSchema.safeParse({
      email: 'sarah@example.com',
      password: 'x',
    })
    expect(result.success).toBe(true)
  })
})
