'use client'

import { useEffect, useState } from 'react'

import type { AutosaveStatus } from './use-autosave'

const TICK_MS = 30_000

/**
 * M1-DESIGN-SPEC.md §3.0's status line copy, pure so the relative-time
 * math is unit-testable without mounting a component or faking a timer
 * loop. "Saved just now" below 60s, then whole minutes, then whole
 * hours — the spec's own two worked examples ("Saved just now" /
 * "Saved 2 minutes ago") don't specify a cutover past an hour, so this
 * picks the coarsest unit that stays readable rather than inventing
 * "3,600 minutes ago".
 */
export function formatSaveStatusLabel(
  status: AutosaveStatus,
  lastSavedAt: Date | null,
  now: Date,
): string | null {
  if (status === 'idle') return null
  if (status === 'saving') return 'Saving…'
  if (status === 'error') return "Couldn't save — check your connection."

  if (!lastSavedAt) return null
  const elapsedMinutes = Math.floor(
    (now.getTime() - lastSavedAt.getTime()) / 60_000,
  )
  if (elapsedMinutes < 1) return 'Saved just now'
  if (elapsedMinutes < 60) {
    return `Saved ${elapsedMinutes} minute${elapsedMinutes === 1 ? '' : 's'} ago`
  }
  const elapsedHours = Math.floor(elapsedMinutes / 60)
  return `Saved ${elapsedHours} hour${elapsedHours === 1 ? '' : 's'} ago`
}

interface SaveStatusProps {
  status: AutosaveStatus
  lastSavedAt: Date | null
}

/**
 * The quiet, persistent autosave status line (§3.0) — `aria-live="polite"`
 * per §5's accessibility checklist ("informational, must not interrupt").
 * Ticks every 30s so a "Saved just now" that's gone stale keeps updating
 * without the user touching the form again.
 */
export function SaveStatus({ status, lastSavedAt }: SaveStatusProps) {
  const [now, setNow] = useState(() => new Date())

  useEffect(() => {
    if (status !== 'saved') return
    const interval = setInterval(() => setNow(new Date()), TICK_MS)
    return () => clearInterval(interval)
  }, [status])

  const label = formatSaveStatusLabel(status, lastSavedAt, now)
  if (!label) return null

  return (
    <p
      aria-live="polite"
      className="opacity-transition text-muted-foreground text-xs"
    >
      {label}
    </p>
  )
}
