import { useCallback, useEffect, useRef, useState } from 'react'

const IDLE_SAVE_MS = 3000

export type AutosaveStatus = 'idle' | 'saving' | 'saved' | 'error'

interface UseAutosaveOptions<T> {
  /** The wizard form's current value snapshot — pass `form.watch()`'s
   * result so this hook's idle timer resets on every keystroke. */
  values: T
  onSave: (values: T) => Promise<void>
  idleMs?: number
}

interface UseAutosaveResult {
  status: AutosaveStatus
  lastSavedAt: Date | null
  /** Fires the save immediately, bypassing the idle timer — the field
   * blur and step-change triggers (M1-DESIGN-SPEC.md §3.0). */
  saveNow: () => void
}

/**
 * The wizard's silent autosave (M1-DESIGN-SPEC.md §3.0): "fires on field
 * blur, on step change ..., and after 3 seconds of typing inactivity —
 * whichever comes first." Three independent triggers converge on one
 * `performSave`, which no-ops on an unchanged snapshot (repeated blurs
 * across untouched fields shouldn't fire a redundant PATCH) — errors are
 * caught, not thrown, since a failed autosave must never interrupt
 * typing (§3.0: "optimistic UI: update immediately, sync later").
 */
export function useAutosave<T>({
  values,
  onSave,
  idleMs = IDLE_SAVE_MS,
}: UseAutosaveOptions<T>): UseAutosaveResult {
  const [status, setStatus] = useState<AutosaveStatus>('idle')
  const [lastSavedAt, setLastSavedAt] = useState<Date | null>(null)

  const lastSavedSnapshotRef = useRef<string | null>(null)
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  // Deliberately not a ref-synced-during-render pattern (React Compiler
  // flags mutating a ref in the render body): performSave depends on
  // `values` directly, so it's recreated whenever they change — cheap,
  // and it's only ever invoked from the debounce effect below or from
  // `saveNow`'s event-handler context, never during render itself.
  const performSave = useCallback(async () => {
    const snapshot = JSON.stringify(values)
    if (snapshot === lastSavedSnapshotRef.current) return

    setStatus('saving')
    try {
      await onSave(values)
      lastSavedSnapshotRef.current = snapshot
      setLastSavedAt(new Date())
      setStatus('saved')
    } catch {
      setStatus('error')
    }
  }, [values, onSave])

  useEffect(() => {
    if (timerRef.current) clearTimeout(timerRef.current)
    timerRef.current = setTimeout(() => {
      void performSave()
    }, idleMs)
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current)
    }
  }, [idleMs, performSave])

  const saveNow = useCallback(() => {
    if (timerRef.current) clearTimeout(timerRef.current)
    void performSave()
  }, [performSave])

  return { status, lastSavedAt, saveNow }
}
