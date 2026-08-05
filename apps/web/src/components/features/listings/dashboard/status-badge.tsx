import { AlertTriangle, Check } from 'lucide-react'

import type { Channel, PropertyStatus } from '@/domain/enums'
import { getDisplayStatus } from '@/domain/display-status'

interface StatusBadgeProps {
  status: PropertyStatus
  channel: Channel
}

/** Sentence-case labels for the statuses domain/display-status.ts's
 * getDisplayStatus shows "as-is" (that helper is written for the
 * *public* detail page, where only under_offer/completed ever need
 * channel-specific copy — see its own doc comment). The dashboard badge
 * is lister-facing, so every status needs a real label; `archived`
 * reuses `hidden`'s label deliberately (M1-DESIGN-SPEC.md §1.3: "if it
 * ever needs to render, it reuses the Hidden treatment, no new
 * tokens"). */
const STATUS_LABEL: Record<
  Exclude<PropertyStatus, 'under_offer' | 'completed'>,
  string
> = {
  draft: 'Draft',
  pending_review: 'Pending review',
  rejected: 'Rejected',
  published: 'Published',
  hidden: 'Hidden',
  archived: 'Archived',
}

/** Tailwind classes for each tonal pair (§1.3's contrast table) — every
 * class here resolves to a `--status-*` custom property added to
 * globals.css §5b, itself an alias onto an existing scale token, never a
 * new colour. */
const STATUS_TONE: Record<
  Exclude<PropertyStatus, 'archived'> | 'archived',
  string
> = {
  draft: 'bg-status-draft-bg text-status-draft-fg',
  pending_review: 'bg-status-pending-bg text-status-pending-fg',
  rejected: 'bg-status-rejected-bg text-status-rejected-fg',
  published: 'bg-status-published-bg text-status-published-fg',
  under_offer: 'bg-status-underoffer-bg text-status-underoffer-fg',
  completed: 'bg-status-completed-bg text-status-completed-fg',
  hidden:
    'bg-status-hidden-bg text-status-hidden-fg border border-status-hidden-border',
  archived:
    'bg-status-hidden-bg text-status-hidden-fg border border-status-hidden-border',
}

function labelFor(status: PropertyStatus, channel: Channel): string {
  if (status === 'under_offer' || status === 'completed') {
    return getDisplayStatus(status, channel)
  }
  return STATUS_LABEL[status]
}

/**
 * StatusBadge — the my-listings dashboard row's status pill
 * (M1-DESIGN-SPEC.md §1.3). Colour is never the only signal (WCAG 1.4.1,
 * §5's checklist): every badge carries a real text label, and the two
 * states that most benefit from being scannable at a glance also carry a
 * small icon (`Rejected`'s AlertTriangle, `completed`'s Check) —
 * everything else is text-only, deliberately, so icons stay a signal
 * rather than decoration repeated on every badge.
 */
export function StatusBadge({ status, channel }: StatusBadgeProps) {
  const label = labelFor(status, channel)
  const Icon =
    status === 'rejected'
      ? AlertTriangle
      : status === 'completed'
        ? Check
        : null

  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full px-3 py-1 text-xs font-medium ${STATUS_TONE[status]}`}
    >
      {Icon && <Icon aria-hidden="true" className="size-3.5" />}
      {label}
    </span>
  )
}
