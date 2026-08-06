'use client'

import { ChevronDown } from 'lucide-react'
import { useEffect, useRef, useState, type ReactNode } from 'react'

import { cn } from '@/lib/utils'

interface FilterPopoverChildArgs {
  close: () => void
}

interface FilterPopoverProps {
  /** Idle label ("Price," "Beds," "Type"). */
  label: string
  /** Resolved-value summary ("£250k–£400k") shown instead of `label`
   * once a value is set (§1.6: "the trigger itself becomes the first
   * readout of state"). */
  summary?: string
  isActive: boolean
  panelId: string
  /** Render-prop for the panel body. Receives `close` so the panel's own
   * Apply button can commit-and-close. The panel is unmounted whenever
   * closed (not hidden), so any local pending state a filter keeps
   * inside `children` is thrown away on outside-click/Escape — exactly
   * §1.6's "closing via outside-click without Apply discards the
   * pending edit," with no extra bookkeeping needed here. */
  children: (args: FilterPopoverChildArgs) => ReactNode
}

/**
 * FilterPopover — the one disclosure primitive introduced in M2
 * (§1.6), built once and reused for every filter trigger. Not a modal:
 * no backdrop, no focus trap, background stays interactive; dismissible
 * by outside-click, Escape, or the panel's own Apply.
 */
export function FilterPopover({
  label,
  summary,
  isActive,
  panelId,
  children,
}: FilterPopoverProps) {
  const [open, setOpen] = useState(false)
  const triggerRef = useRef<HTMLButtonElement>(null)
  const panelRef = useRef<HTMLDivElement>(null)

  function close() {
    setOpen(false)
    triggerRef.current?.focus()
  }

  useEffect(() => {
    if (!open) return

    const firstControl = panelRef.current?.querySelector<HTMLElement>(
      'input, select, button, [href], [tabindex]',
    )
    firstControl?.focus()

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') {
        event.preventDefault()
        close()
      }
    }

    function handlePointerDown(event: MouseEvent) {
      const target = event.target as Node
      if (panelRef.current?.contains(target)) return
      if (triggerRef.current?.contains(target)) return
      setOpen(false)
    }

    document.addEventListener('keydown', handleKeyDown)
    document.addEventListener('mousedown', handlePointerDown)
    return () => {
      document.removeEventListener('keydown', handleKeyDown)
      document.removeEventListener('mousedown', handlePointerDown)
    }
  }, [open])

  return (
    <div className="relative inline-block">
      <button
        ref={triggerRef}
        type="button"
        aria-expanded={open}
        aria-haspopup="dialog"
        aria-controls={panelId}
        onClick={() => setOpen((value) => !value)}
        className={cn(
          'inline-flex h-11 items-center gap-1.5 rounded-[var(--radius-md)] border px-3 text-sm font-medium',
          isActive
            ? 'border-primary bg-clay-050 text-foreground'
            : 'border-input text-muted-foreground',
        )}
      >
        {summary ?? label}
        <ChevronDown
          aria-hidden="true"
          className={cn(
            'opacity-transition size-3.5 transition-transform duration-150 ease-out',
            open && 'rotate-180',
          )}
        />
      </button>

      {open && (
        <div
          ref={panelRef}
          id={panelId}
          role="dialog"
          aria-label={`${label} filter`}
          className="border-border bg-card w-full min-w-[280px] rounded-[var(--radius-md)] border p-4 sm:absolute sm:top-full sm:left-0 sm:z-20 sm:mt-2 sm:w-[280px]"
        >
          {/* eslint-disable-next-line react-hooks/refs -- `close` reads `triggerRef.current` only when invoked; every current caller (RangeFilterPopover, MultiSelectFilterPopover, AvailableByFilter) only calls it from its own Apply/Reset onClick handlers, never synchronously while computing this render prop's own JSX. */}
          {children({ close })}
        </div>
      )}
    </div>
  )
}
