/**
 * Listing title + slug generation (PRD §6.5 LST-2, §7.2, §9.2). Pure and
 * framework-free (PRD §8.5) so services/listings/* can call these without
 * any port. Both title and slug are always server-derived — never client
 * input — mirroring services/listers/create-agency.ts's slug convention.
 *
 * The PRD gives exactly one worked example of each: §9.2's title "3 bed
 * semi-detached house for sale", and §7.2's slug segment
 * "3-bed-semi-detached-house-rg30". Everything this file adds beyond those
 * two data points is a documented decision, not a PRD requirement:
 *
 *  - Rent phrasing ("to rent") mirrors the "for sale"/"to rent" pairing
 *    used throughout UK property portals; the PRD only shows the sale case.
 *  - A 0-bedroom listing (studio — PRD §9.2 explicitly allows bedrooms=0)
 *    renders as "Studio", not "0 bed".
 *  - The slug's uniqueness suffix is 6 hex characters taken from the tail
 *    of a caller-supplied UUID seed (services/listings/create-listing-draft.ts
 *    and submit-listing.ts pass `crypto.randomUUID()`, not the property's
 *    own row id — the row id isn't known before insert, see those
 *    services' doc comments). Collisions on `properties.slug`'s unique
 *    index are not retried (unlike CreateAgency's slug dedupe loop): at
 *    ~16.7M possible suffixes per identical base, the probability is low
 *    enough that this is a deliberate scope cut for M1, not an oversight.
 */

import type { Channel, PropertyType } from './enums'

const PROPERTY_TYPE_LABEL: Record<PropertyType, string> = {
  detached: 'detached house',
  semi_detached: 'semi-detached house',
  terraced: 'terraced house',
  flat: 'flat',
  bungalow: 'bungalow',
  maisonette: 'maisonette',
  land: 'land',
  other: 'property',
}

const CHANNEL_SUFFIX: Record<Channel, string> = {
  sale: 'for sale',
  rent: 'to rent',
}

/** "3 bed semi-detached house", "Studio flat" — shared by the title (which
 * appends a channel suffix) and the slug (which appends an outcode and a
 * uniqueness suffix instead). */
function describeProperty(
  bedrooms: number,
  propertyType: PropertyType,
): string {
  const bedroomsLabel = bedrooms === 0 ? 'Studio' : `${bedrooms} bed`
  return `${bedroomsLabel} ${PROPERTY_TYPE_LABEL[propertyType]}`
}

export interface GenerateListingTitleInput {
  bedrooms: number
  propertyType: PropertyType
  channel: Channel
}

export function generateListingTitle({
  bedrooms,
  propertyType,
  channel,
}: GenerateListingTitleInput): string {
  return `${describeProperty(bedrooms, propertyType)} ${CHANNEL_SUFFIX[channel]}`
}

export interface GenerateListingSlugInput {
  bedrooms: number
  propertyType: PropertyType
  outcode: string
  /** A fresh UUID whose trailing hex characters back the slug's uniqueness
   * suffix — see this file's doc comment for why it is not the property's
   * own row id. */
  uniqueSeed: string
}

const SLUG_SUFFIX_LENGTH = 6

export function generateListingSlug({
  bedrooms,
  propertyType,
  outcode,
  uniqueSeed,
}: GenerateListingSlugInput): string {
  const base = slugifyListingBase(
    `${describeProperty(bedrooms, propertyType)} ${outcode}`,
  )
  const suffix = uniqueSeed.replace(/-/g, '').slice(-SLUG_SUFFIX_LENGTH)
  return `${base}-${suffix}`
}

/** Local, minimal kebab-caser rather than importing domain/slug.ts's
 * slugify: that helper strips accents/punctuation for free-text agency
 * names, which is more than this fixed, already-ASCII "{bed} {type}
 * {outcode}" string ever needs — this just lowercases and hyphenates. */
function slugifyListingBase(input: string): string {
  return input
    .toLowerCase()
    .trim()
    .replace(/\s+/g, ' ')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
}
