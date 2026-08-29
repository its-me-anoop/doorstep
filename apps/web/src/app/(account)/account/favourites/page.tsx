import type { Metadata } from 'next'
import Link from 'next/link'
import { redirect } from 'next/navigation'

import { SaveHeartButton } from '@/components/features/saved/save-heart-button'
import { formatPrice } from '@/domain/money'
import { createServices } from '@/lib/composition'
import { getSessionUser } from '@/lib/session'

export const metadata: Metadata = { title: 'Favourites' }

export default async function FavouritesPage() {
  const session = await getSessionUser()
  if (!session) redirect('/sign-in?next=%2Faccount%2Ffavourites')

  const { saved } = createServices()
  const favourites = await saved.listSavedProperties.execute(session.user)

  return (
    <div className="mx-auto max-w-[880px] px-5 py-16 sm:px-8">
      <h1 className="text-[length:var(--text-h1)] leading-[1.12]">
        Favourites
      </h1>

      {favourites.length === 0 ? (
        <p className="text-muted-foreground mt-8 text-base leading-relaxed">
          You have not saved any properties yet. Tap the heart on a listing to
          add it here.
        </p>
      ) : (
        <ul className="mt-10 flex flex-col gap-4">
          {favourites.map(({ listing, savedAt }) => (
            <li
              key={listing.id}
              className="border-border bg-card flex items-center justify-between gap-4 rounded-[var(--radius-md)] border p-4"
            >
              <div>
                <Link
                  href={`/property/${listing.slug}`}
                  className="text-foreground text-base font-medium hover:underline"
                >
                  {listing.title}
                </Link>
                <p className="text-muted-foreground mt-1 text-sm">
                  {listing.displayAddress}
                </p>
                <p className="text-foreground mt-1 text-sm">
                  {formatPrice({
                    channel: listing.channel,
                    price: listing.price,
                    priceQualifier: 'fixed',
                  })}
                </p>
                <p className="text-muted-foreground mt-1 text-xs">
                  Saved {savedAt.toLocaleDateString('en-GB')}
                  {listing.displayStatus !== 'published' &&
                    ` · ${listing.displayStatus}`}
                </p>
              </div>
              <SaveHeartButton
                propertyId={listing.id}
                initialSaved
                signedIn
              />
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
