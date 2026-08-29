import type { Metadata } from 'next'
import Link from 'next/link'
import { redirect } from 'next/navigation'

import { ModerationQueueActions } from '@/components/features/admin/moderation-queue-actions'
import { ReportActions } from '@/components/features/admin/report-actions'
import { UserAdminActions } from '@/components/features/admin/user-admin-actions'
import { createServices } from '@/lib/composition'
import { getSessionUser } from '@/lib/session'
import type { User } from '@/ports/user-repository'

export const metadata: Metadata = { title: 'Admin' }

interface AdminPageProps {
  searchParams: Promise<{ tab?: string; q?: string }>
}

export default async function AdminPage({ searchParams }: AdminPageProps) {
  const session = await getSessionUser()
  if (!session || session.user.role !== 'admin') {
    redirect('/')
  }

  const params = await searchParams
  const tab = params.tab ?? 'queue'
  const { admin } = createServices()
  const actor = session.user

  return (
    <div className="mx-auto max-w-[960px] px-5 py-16 sm:px-8">
      <h1 className="text-[length:var(--text-h1)] leading-[1.12]">Admin</h1>

      <nav className="mt-8 flex flex-wrap gap-4 border-b border-border pb-4">
        {(
          [
            ['queue', 'Queue'],
            ['reports', 'Reports'],
            ['users', 'Users'],
            ['metrics', 'Metrics'],
            ['audit', 'Audit log'],
          ] as const
        ).map(([id, label]) => (
          <Link
            key={id}
            href={`/admin?tab=${id}`}
            className={
              tab === id
                ? 'text-foreground text-sm font-medium'
                : 'text-muted-foreground hover:text-foreground text-sm'
            }
          >
            {label}
          </Link>
        ))}
      </nav>

      <div className="mt-10">
        {tab === 'queue' && <QueueSection actor={actor} admin={admin} />}
        {tab === 'reports' && <ReportsSection actor={actor} admin={admin} />}
        {tab === 'users' && (
          <UsersSection actor={actor} admin={admin} query={params.q} />
        )}
        {tab === 'metrics' && <MetricsSection actor={actor} admin={admin} />}
        {tab === 'audit' && <AuditSection actor={actor} admin={admin} />}
      </div>
    </div>
  )
}

async function QueueSection({
  actor,
  admin,
}: {
  actor: User
  admin: ReturnType<typeof createServices>['admin']
}) {
  const page = await admin.listModerationQueue.execute(actor)

  if (page.data.length === 0) {
    return (
      <p className="text-muted-foreground text-base">No listings awaiting review.</p>
    )
  }

  return (
    <ul className="flex flex-col gap-4">
      {page.data.map((listing) => (
        <li
          key={listing.id}
          className="border-border bg-card rounded-[var(--radius-md)] border p-4"
        >
          <p className="text-foreground font-medium">{listing.title}</p>
          <p className="text-muted-foreground text-sm">
            {listing.displayAddress} · {listing.channel}
          </p>
          <ModerationQueueActions listing={listing} />
        </li>
      ))}
    </ul>
  )
}

async function ReportsSection({
  actor,
  admin,
}: {
  actor: User
  admin: ReturnType<typeof createServices>['admin']
}) {
  const page = await admin.listOpenReports.execute(actor)

  if (page.data.length === 0) {
    return <p className="text-muted-foreground text-base">No open reports.</p>
  }

  return (
    <ul className="flex flex-col gap-4">
      {page.data.map((report) => (
        <li
          key={report.id}
          className="border-border bg-card rounded-[var(--radius-md)] border p-4"
        >
          <p className="text-foreground font-medium">{report.reason}</p>
          {report.details && (
            <p className="text-muted-foreground mt-2 text-sm">{report.details}</p>
          )}
          <p className="text-muted-foreground mt-2 text-xs">
            Listing {report.propertyId} ·{' '}
            {report.createdAt.toLocaleString('en-GB')}
          </p>
          <ReportActions report={report} />
        </li>
      ))}
    </ul>
  )
}

async function UsersSection({
  actor,
  admin,
  query,
}: {
  actor: User
  admin: ReturnType<typeof createServices>['admin']
  query?: string
}) {
  const page = await admin.searchUsers.execute(actor, { q: query, limit: 20 })

  return (
    <div>
      <form method="get" action="/admin" className="mb-6 flex gap-2">
        <input
          name="q"
          defaultValue={query ?? ''}
          placeholder="Search by name or email"
          className="border-input h-10 flex-1 rounded-lg border bg-transparent px-3 text-sm"
        />
        <input type="hidden" name="tab" value="users" />
        <button
          type="submit"
          className="bg-primary text-primary-foreground h-10 rounded-[var(--radius-md)] px-4 text-sm font-medium"
        >
          Search
        </button>
      </form>

      <ul className="flex flex-col gap-4">
        {page.data.map((user) => (
          <li
            key={user.id}
            className="border-border bg-card rounded-[var(--radius-md)] border p-4"
          >
            <p className="text-foreground font-medium">{user.displayName}</p>
            <p className="text-muted-foreground text-sm">
              {user.email} · {user.role} · {user.status}
            </p>
            <UserAdminActions user={user} />
          </li>
        ))}
      </ul>
    </div>
  )
}

async function MetricsSection({
  actor,
  admin,
}: {
  actor: User
  admin: ReturnType<typeof createServices>['admin']
}) {
  const metrics = await admin.getMetrics.execute(actor)

  return (
    <dl className="grid gap-6 sm:grid-cols-2">
      <Metric label="Live for sale" value={metrics.liveListings.sale} />
      <Metric label="Live to rent" value={metrics.liveListings.rent} />
      <Metric label="Pending review" value={metrics.pendingReviewCount} />
      <Metric label="New users (30d)" value={metrics.newUsersLast30Days} />
      <div className="sm:col-span-2">
        <h2 className="text-foreground text-sm font-medium">Top searched areas</h2>
        <ul className="text-muted-foreground mt-2 text-sm">
          {metrics.topSearchedAreas.map((row) => (
            <li key={row.value}>
              {row.value}: {row.count}
            </li>
          ))}
        </ul>
      </div>
    </dl>
  )
}

function Metric({ label, value }: { label: string; value: number }) {
  return (
    <div className="border-border bg-card rounded-[var(--radius-md)] border p-4">
      <dt className="text-muted-foreground text-sm">{label}</dt>
      <dd className="text-foreground mt-1 text-2xl font-medium">{value}</dd>
    </div>
  )
}

async function AuditSection({
  actor,
  admin,
}: {
  actor: User
  admin: ReturnType<typeof createServices>['admin']
}) {
  const page = await admin.listAuditLog.execute(actor, { limit: 30 })

  return (
    <ul className="flex flex-col gap-3">
      {page.data.map((entry) => (
        <li
          key={entry.id}
          className="border-border border-b pb-3 text-sm last:border-0"
        >
          <span className="text-foreground font-medium">{entry.action}</span>
          <span className="text-muted-foreground">
            {' '}
            · {entry.entityType} {entry.entityId}
          </span>
          <p className="text-muted-foreground text-xs">
            {entry.createdAt.toLocaleString('en-GB')}
            {entry.reason ? ` · ${entry.reason}` : ''}
          </p>
        </li>
      ))}
    </ul>
  )
}
