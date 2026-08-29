import type { Metadata } from 'next'
import Link from 'next/link'
import { redirect } from 'next/navigation'

import { DeleteSavedSearchButton } from '@/components/features/saved/delete-saved-search-button'
import { createServices } from '@/lib/composition'
import { getSessionUser } from '@/lib/session'

export const metadata: Metadata = { title: 'Saved searches' }

export default async function SavedSearchesPage() {
  const session = await getSessionUser()
  if (!session) redirect('/sign-in?next=%2Faccount%2Fsaved-searches')

  const { saved } = createServices()
  const searches = await saved.listSavedSearches.execute(session.user)

  return (
    <div className="mx-auto max-w-[880px] px-5 py-16 sm:px-8">
      <h1 className="text-[length:var(--text-h1)] leading-[1.12]">
        Saved searches
      </h1>

      {searches.length === 0 ? (
        <p className="text-muted-foreground mt-8 text-base leading-relaxed">
          Save a search from the results page to return to it quickly.
        </p>
      ) : (
        <ul className="mt-10 flex flex-col gap-4">
          {searches.map((search) => {
            const channelSlug =
              search.criteria.channel === 'sale' ? 'for-sale' : 'to-rent'
            const href = `/${channelSlug}/search?label=${encodeURIComponent(search.criteria.locationLabel)}`

            return (
              <li
                key={search.id}
                className="border-border bg-card flex items-center justify-between gap-4 rounded-[var(--radius-md)] border p-4"
              >
                <div>
                  <Link
                    href={href}
                    className="text-foreground text-base font-medium hover:underline"
                  >
                    {search.name}
                  </Link>
                  <p className="text-muted-foreground mt-1 text-sm">
                    {search.criteria.locationLabel || 'Anywhere'} ·{' '}
                    {search.criteria.channel === 'sale'
                      ? 'For sale'
                      : 'To rent'}
                  </p>
                </div>
                <DeleteSavedSearchButton searchId={search.id} />
              </li>
            )
          })}
        </ul>
      )}
    </div>
  )
}
