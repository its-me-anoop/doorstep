import { describe, expect, it } from 'vitest'

import { createAgencySchema } from '@/lib/validation/agency'

function issueMessage(result: {
  success: boolean
  error?: { issues: { message: string }[] }
}) {
  return result.error?.issues[0]?.message
}

// Shared client/server schema for PRD §6.5 LST-1's agent onboarding path
// (services/listers/create-agency.ts). Slug is deliberately absent —
// it's server-generated (domain/slug.ts), never client input.
describe('createAgencySchema', () => {
  const valid = {
    name: 'Thameside Property Partners',
    phone: '0118 950 1147',
    email: 'hello@thamesidepropertypartners.co.uk',
    website: 'https://www.thamesidepropertypartners.co.uk',
    address: '12 Kings Road, Reading, RG1 3AA',
  }

  it('accepts a fully valid submission', () => {
    expect(createAgencySchema.safeParse(valid).success).toBe(true)
  })

  it('rejects a name under 2 characters', () => {
    const result = createAgencySchema.safeParse({ ...valid, name: 'A' })
    expect(result.success).toBe(false)
    expect(issueMessage(result)).toBe(
      'Agency name must be at least 2 characters.',
    )
  })

  it('treats a whitespace-only name as empty', () => {
    const result = createAgencySchema.safeParse({ ...valid, name: '   ' })
    expect(result.success).toBe(false)
  })

  it('rejects a name over 80 characters', () => {
    const result = createAgencySchema.safeParse({
      ...valid,
      name: 'A'.repeat(81),
    })
    expect(result.success).toBe(false)
    expect(issueMessage(result)).toBe(
      'Agency name must be 80 characters or fewer.',
    )
  })

  it('accepts a name at exactly the 80 character boundary', () => {
    const result = createAgencySchema.safeParse({
      ...valid,
      name: 'A'.repeat(80),
    })
    expect(result.success).toBe(true)
  })

  it('requires a phone number', () => {
    const result = createAgencySchema.safeParse({ ...valid, phone: '' })
    expect(issueMessage(result)).toBe('Enter a contact phone number.')
  })

  it('rejects a phone number with letters', () => {
    const result = createAgencySchema.safeParse({
      ...valid,
      phone: 'not-a-phone-number',
    })
    expect(issueMessage(result)).toBe(
      "That phone number doesn't look quite right — check for typos.",
    )
  })

  it('accepts a UK mobile-shaped phone number', () => {
    const result = createAgencySchema.safeParse({
      ...valid,
      phone: '07700 900201',
    })
    expect(result.success).toBe(true)
  })

  it('requires an email address', () => {
    const result = createAgencySchema.safeParse({ ...valid, email: '' })
    expect(issueMessage(result)).toBe('Enter a contact email address.')
  })

  it('rejects a malformed email', () => {
    const result = createAgencySchema.safeParse({
      ...valid,
      email: 'not-an-email',
    })
    expect(issueMessage(result)).toBe(
      "That email address doesn't look quite right — check for typos.",
    )
  })

  it('requires a website', () => {
    const result = createAgencySchema.safeParse({ ...valid, website: '' })
    expect(issueMessage(result)).toBe('Enter your agency website.')
  })

  it('rejects a malformed website URL', () => {
    const result = createAgencySchema.safeParse({
      ...valid,
      website: 'not-a-url',
    })
    expect(issueMessage(result)).toBe(
      "That website address doesn't look quite right — check for typos.",
    )
  })

  it('requires an address', () => {
    const result = createAgencySchema.safeParse({ ...valid, address: '' })
    expect(issueMessage(result)).toBe('Enter your branch address.')
  })

  it('trims surrounding whitespace on every field', () => {
    const result = createAgencySchema.safeParse({
      name: '  Thameside Property Partners  ',
      phone: '  0118 950 1147  ',
      email: '  hello@thamesidepropertypartners.co.uk  ',
      website: '  https://www.thamesidepropertypartners.co.uk  ',
      address: '  12 Kings Road, Reading, RG1 3AA  ',
    })
    expect(result.success).toBe(true)
    if (result.success) {
      expect(result.data.name).toBe('Thameside Property Partners')
      expect(result.data.address).toBe('12 Kings Road, Reading, RG1 3AA')
    }
  })
})
