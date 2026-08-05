import { describe, expect, it } from 'vitest'

import { formatSaveStatusLabel } from '@/components/features/listings/wizard/save-status'

// M1-DESIGN-SPEC.md §3.0: "cycles 'Saving…' -> 'Saved just now,' then
// updates to relative time ('Saved 2 minutes ago') rather than
// disappearing."
describe('formatSaveStatusLabel', () => {
  const now = new Date('2026-08-05T12:00:00.000Z')

  it('idle: no status line yet (nothing has been saved this session)', () => {
    expect(formatSaveStatusLabel('idle', null, now)).toBeNull()
  })

  it('saving: "Saving…"', () => {
    expect(formatSaveStatusLabel('saving', null, now)).toBe('Saving…')
  })

  it('saved under a minute ago: "Saved just now"', () => {
    const lastSavedAt = new Date('2026-08-05T11:59:40.000Z')
    expect(formatSaveStatusLabel('saved', lastSavedAt, now)).toBe(
      'Saved just now',
    )
  })

  it('saved 2 minutes ago: "Saved 2 minutes ago"', () => {
    const lastSavedAt = new Date('2026-08-05T11:58:00.000Z')
    expect(formatSaveStatusLabel('saved', lastSavedAt, now)).toBe(
      'Saved 2 minutes ago',
    )
  })

  it('saved exactly 1 minute ago uses the singular', () => {
    const lastSavedAt = new Date('2026-08-05T11:59:00.000Z')
    expect(formatSaveStatusLabel('saved', lastSavedAt, now)).toBe(
      'Saved 1 minute ago',
    )
  })

  it('saved over an hour ago', () => {
    const lastSavedAt = new Date('2026-08-05T10:00:00.000Z')
    expect(formatSaveStatusLabel('saved', lastSavedAt, now)).toBe(
      'Saved 2 hours ago',
    )
  })

  it('error: a plain, specific retry message', () => {
    expect(formatSaveStatusLabel('error', null, now)).toBe(
      "Couldn't save — check your connection.",
    )
  })
})
