import type { Metadata } from 'next'
import Link from 'next/link'
import { redirect } from 'next/navigation'

import { DeleteAccountButton } from '@/components/features/account/delete-account-button'
import { ProfileForm } from '@/components/features/account/profile-form'
import { Button } from '@/components/ui/button'
import { greetingFor } from '@/lib/greeting'
import { getSessionUser } from '@/lib/session'

export const metadata: Metadata = { title: 'Account' }

export default async function AccountPage() {
  const session = await getSessionUser()
  if (!session) redirect('/sign-in?next=%2Faccount')

  const { user } = session
  const greeting = greetingFor(new Date().getHours(), user.displayName)

  return (
    <div className="mx-auto max-w-[640px] px-5 pt-16 pb-24 sm:px-8">
      <h1 className="text-[length:var(--text-h1)] leading-[1.12]">
        {greeting}
      </h1>

      <div className="border-border bg-card mt-10 rounded-[var(--radius-lg)] border p-8">
        <dl className="flex flex-col gap-6">
          <div>
            <dt className="text-muted-foreground text-sm">Email</dt>
            <dd className="text-foreground mt-1 text-base">{user.email}</dd>
            <p className="text-muted-foreground mt-1 text-sm">
              Contact us to change your email
            </p>
          </div>
          <div>
            <dt className="text-muted-foreground text-sm">Role</dt>
            <dd className="mt-1">
              <span className="bg-secondary text-secondary-foreground inline-flex items-center rounded-full px-3 py-1 text-xs font-medium capitalize">
                {user.role}
              </span>
            </dd>
          </div>
        </dl>

        <ProfileForm
          initialDisplayName={user.displayName}
          initialPhone={user.phone}
        />
      </div>

      <div className="mt-10 flex flex-col gap-3">
        <h2 className="text-[length:var(--text-h3)]">Saved items</h2>
        <div className="flex flex-wrap gap-3">
          <Button
            render={<Link href="/account/favourites" />}
            variant="secondary"
            className="h-11 rounded-[var(--radius-md)] px-6"
          >
            Favourites
          </Button>
          <Button
            render={<Link href="/account/saved-searches" />}
            variant="secondary"
            className="h-11 rounded-[var(--radius-md)] px-6"
          >
            Saved searches
          </Button>
        </div>
      </div>

      <div className="mt-12">
        {user.role === 'user' ? (
          <>
            <p className="text-muted-foreground max-w-[60ch] text-base leading-relaxed">
              Selling or letting a property? Doorstep&rsquo;s free while we
              build supply in Reading.
            </p>
            <Button
              render={<Link href="/onboarding" />}
              variant="secondary"
              className="mt-4 h-11 rounded-[var(--radius-md)] px-6"
            >
              Start listing a property
            </Button>
          </>
        ) : (
          <div className="flex flex-wrap gap-3">
            <Button
              render={<Link href="/lister" />}
              variant="secondary"
              className="h-11 rounded-[var(--radius-md)] px-6"
            >
              Your listings
            </Button>
            {(user.role === 'owner' ||
              user.role === 'agent' ||
              user.role === 'admin') && (
              <Button
                render={<Link href="/lister/enquiries" />}
                variant="secondary"
                className="h-11 rounded-[var(--radius-md)] px-6"
              >
                Enquiries inbox
              </Button>
            )}
          </div>
        )}
      </div>

      <div className="border-border mt-16 border-t pt-10">
        <h2 className="text-[length:var(--text-h3)]">Delete account</h2>
        <p className="text-muted-foreground mt-2 max-w-[60ch] text-sm leading-relaxed">
          Remove your Doorstep profile and personal data in line with our{' '}
          <Link href="/privacy" className="text-primary underline-offset-2 hover:underline">
            privacy policy
          </Link>
          .
        </p>
        <div className="mt-4">
          <DeleteAccountButton />
        </div>
      </div>
    </div>
  )
}
