/**
 * `/property/{slug}` — the public listing detail page (PRD §6.2 DET-1/2/3,
 * M2-DESIGN-SPEC.md §5). This is the route the rest of the app already
 * links to (components/features/search/result-card.tsx's card link) — a
 * deliberate, already-established deviation from PRD §7.2's illustrative
 * `/for-sale/{area}/{slug}/{id}` pattern; see this milestone's own report
 * for the full reasoning. `{slug}` alone is the canonical identity here.
 *
 * ISR (PRD §8.3: "ISR with on-demand revalidation triggered by publish,
 * edit and status changes"): `revalidate` below is the time-based safety
 * net; the real freshness mechanism is the on-demand
 * `revalidatePath('/property/{slug}')` call added to the status/PATCH
 * mutation routes (lib/listing-revalidation.ts) — this page reads no
 * `searchParams`, so (unlike the area landing pages) it gets real,
 * uncompromised ISR: cached at the edge, regenerated on interval or on
 * demand, not forced dynamic per request.
 *
 * `generateMetadata` and the page body each call GetPublicListing once —
 * a deliberate, documented duplicate read rather than reaching for
 * React's `cache()`: memoizing across a route's metadata/render pass
 * needs the Next.js RSC request-scoped cache context to reset correctly
 * between requests, which this repo's Vitest unit tests (page functions
 * called directly, not through a real RSC render) can't reliably
 * exercise — a stale cross-test cache hit would be a worse failure mode
 * than one extra composition-root call for a single-object read.
 */

import type { Metadata } from 'next'
import { notFound } from 'next/navigation'

import { Breadcrumb } from '@/components/features/search/breadcrumb'
import { CoverGallery } from '@/components/features/listings/detail/cover-gallery'
import { DescriptionSection } from '@/components/features/listings/detail/description-section'
import { KeyFacts } from '@/components/features/listings/detail/key-facts'
import { LocationSection } from '@/components/features/listings/detail/location-section'
import { ListerCard } from '@/components/features/listings/detail/lister-card'
import { StatusBanner } from '@/components/features/listings/detail/status-banner'
import { findAreasMatchingListing } from '@/lib/areas'
import { createServices } from '@/lib/composition'
import { PublicListingNotFoundError } from '@/services/listings/errors'
import type { PublicListingDetail } from '@/services/listings/get-public-listing'

export const revalidate = 3600

interface PropertyDetailPageProps {
  params: Promise<{ slug: string }>
}

const CHANNEL_SLUG = { sale: 'for-sale', rent: 'to-rent' } as const
const CHANNEL_CRUMB_LABEL = { sale: 'For sale', rent: 'To rent' } as const

async function loadListing(slug: string): Promise<PublicListingDetail | null> {
  const { listings } = createServices()
  try {
    return await listings.getPublicListing.execute(slug)
  } catch (error) {
    if (error instanceof PublicListingNotFoundError) return null
    throw error
  }
}

function todayIsoDate(): string {
  return new Date().toISOString().slice(0, 10)
}

/** OG image: the cover's 1600w webp variant, matching PRD §7.2's
 * "per-listing OG image (cover photo) for link sharing." */
function ogImageUrl(listing: PublicListingDetail): string | undefined {
  return listing.images[0]?.urls.find(
    (url) => url.width === 1600 && url.format === 'webp',
  )?.url
}

export async function generateMetadata({
  params,
}: PropertyDetailPageProps): Promise<Metadata> {
  const { slug } = await params
  const listing = await loadListing(slug)
  if (!listing) return {}

  const image = ogImageUrl(listing)
  return {
    title: `${listing.title} — ${listing.displayAddress}`,
    description: listing.description.slice(0, 155),
    alternates: { canonical: `/property/${listing.slug}` },
    ...(image ? { openGraph: { images: [{ url: image }] } } : {}),
  }
}

/** schema.org RealEstateListing (PRD §7.2). Added because the data is
 * already fully resolved on this page (no extra fetch) — the
 * BreadcrumbList half of §7.2's structured-data requirement is already
 * covered for free by Breadcrumb's own JSON-LD. */
function realEstateListingJsonLd(listing: PublicListingDetail) {
  return {
    '@context': 'https://schema.org',
    '@type': 'RealEstateListing',
    name: listing.title,
    description: listing.description,
    url: `/property/${listing.slug}`,
    ...(ogImageUrl(listing) ? { image: ogImageUrl(listing) } : {}),
    address: {
      '@type': 'PostalAddress',
      addressLocality: listing.town,
      postalCode: listing.outcode,
      addressCountry: 'GB',
    },
    offers: {
      '@type': 'Offer',
      price: listing.price,
      priceCurrency: 'GBP',
      availability:
        listing.displayStatus === 'published'
          ? 'https://schema.org/InStock'
          : 'https://schema.org/PreOrder',
    },
  }
}

export default async function PropertyDetailPage({
  params,
}: PropertyDetailPageProps) {
  const { slug } = await params
  const listing = await loadListing(slug)
  if (!listing) {
    notFound()
    return null
  }

  const area = findAreasMatchingListing(listing.town, listing.outcode)[0]

  return (
    <div className="mx-auto flex max-w-[900px] flex-col gap-8 px-5 py-10 sm:px-8 lg:px-16">
      <Breadcrumb
        items={[
          { label: 'Home', href: '/' },
          {
            label: CHANNEL_CRUMB_LABEL[listing.channel],
            href: `/${CHANNEL_SLUG[listing.channel]}`,
          },
          ...(area
            ? [
                {
                  label: area.label,
                  href: `/${CHANNEL_SLUG[listing.channel]}/${area.slug}`,
                },
              ]
            : []),
          { label: listing.title },
        ]}
      />

      <StatusBanner
        displayStatus={listing.displayStatus}
        channel={listing.channel}
      />

      <CoverGallery title={listing.title} images={listing.images} />

      <KeyFacts
        channel={listing.channel}
        price={listing.price}
        priceQualifier={listing.priceQualifier}
        bedrooms={listing.bedrooms}
        bathrooms={listing.bathrooms}
        propertyType={listing.propertyType}
        tenure={listing.tenure}
        furnished={listing.furnished}
        availableFrom={listing.availableFrom}
        epcRating={listing.epcRating}
        councilTaxBand={listing.councilTaxBand}
        todayIso={todayIsoDate()}
      />

      <DescriptionSection
        description={listing.description}
        features={listing.features}
      />

      <LocationSection displayAddress={listing.displayAddress} />

      <ListerCard
        channel={listing.channel}
        town={listing.town}
        agency={listing.agency}
      />

      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify(realEstateListingJsonLd(listing)),
        }}
      />
    </div>
  )
}
