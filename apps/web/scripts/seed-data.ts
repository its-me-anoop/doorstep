/**
 * Typed, literal fixture data for the local-dev seed script (scripts/seed.ts).
 *
 * Deliberately deterministic: every field below is a literal value or the
 * output of a pure function of literal inputs (buildPropertyImages). There
 * is no Math.random(), Date.now() or other non-deterministic source, so
 * running the seed script twice inserts byte-identical rows — required for
 * the delete-by-known-slug idempotency in seed.ts.
 *
 * `SeedAgency`/`SeedUser`/`SeedProperty` are insert-shaped, not full
 * entities: no `id`, `createdAt` or `updatedAt` (Drizzle/Postgres generate
 * those). Cross-references between fixtures are by natural key (slug,
 * email) rather than a foreign-key id, because ids don't exist until
 * insert time — seed.ts resolves them after each insert.
 */

import type {
  Channel,
  CouncilTaxBand,
  EpcRating,
  Furnished,
  ImageKind,
  PriceQualifier,
  PropertyStatus,
  PropertyType,
  Tenure,
  UserRole,
  UserStatus,
} from '@/domain/enums'
import type { GeoPoint } from '@/domain/property'

/** Every row this script writes carries this value nowhere in the schema
 * itself (there is no "source" column) — instead it is folded into every
 * firebase_uid (`seed-...`) and reused as the known-slug delete list in
 * seed.ts, which is what actually makes re-running idempotent. Exported so
 * seed.ts and its tests can refer to the same literal. */
export const SEED_MARKER = 'doorstep-seed'

export interface SeedAgency {
  slug: string
  name: string
  phone: string
  email: string
  website: string
  address: string
  verified: boolean
  /** Resolved to a user id at insert time — agencies.created_by (PRD §9.2,
   * "Agency admin in MVP"). Must match a SEED_USERS email. */
  createdByEmail: string
}

export interface SeedUser {
  firebaseUid: string
  email: string
  displayName: string
  phone: string | null
  role: UserRole
  /** Resolved to an agency id at insert time. Agents only. */
  agencySlug: string | null
  status: UserStatus
}

export interface SeedPropertyImage {
  kind: ImageKind
  storagePath: string
  /** 0 = cover. */
  position: number
  width: number
  height: number
  blurhash: string
  altText: string
}

export interface SeedProperty {
  slug: string
  /** Resolved to a user id at insert time. */
  listerEmail: string
  /** Resolved to an agency id at insert time; null for private listings. */
  agencySlug: string | null
  channel: Channel
  status: PropertyStatus
  propertyType: PropertyType
  title: string
  description: string
  features: string[]
  bedrooms: number
  bathrooms: number
  price: number
  priceQualifier: PriceQualifier
  /** Sale only. */
  tenure: Tenure | null
  /** Rent only, pounds. */
  deposit: number | null
  /** Rent only. */
  furnished: Furnished | null
  /** Rent only, ISO date. */
  availableFrom: string | null
  epcRating: EpcRating | null
  councilTaxBand: CouncilTaxBand | null
  addressLine1: string
  displayAddress: string
  town: string
  outcode: string
  postcode: string
  location: GeoPoint
  locationApproximate: boolean
  /** ISO datetime; null until the listing has been published at least once. */
  publishedAt: string | null
  images: SeedPropertyImage[]
}

// ---------------------------------------------------------------------------
// Agencies
// ---------------------------------------------------------------------------

export const SEED_AGENCIES: SeedAgency[] = [
  {
    slug: 'thameside-property-partners',
    name: 'Thameside Property Partners',
    phone: '0118 950 1147',
    address: '24 London Street, Reading, RG1 4PN',
    email: 'hello@thamesidepropertypartners.co.uk',
    website: 'https://www.thamesidepropertypartners.co.uk',
    verified: true,
    createdByEmail: 'priya.kapoor@thamesidepropertypartners.co.uk',
  },
  {
    slug: 'caversham-kennet-estates',
    name: 'Caversham & Kennet Estates',
    phone: '0118 946 2830',
    address: '9 Prospect Street, Caversham, Reading, RG4 8JG',
    email: 'enquiries@cavershamkennetestates.co.uk',
    website: 'https://www.cavershamkennetestates.co.uk',
    verified: true,
    createdByEmail: 'daniel.osei@cavershamkennetestates.co.uk',
  },
  {
    // Set up by Daniel Osei (see SEED_USERS) before it was staffed — the
    // `created_by` FK only records who created the agency row, not who
    // currently works there, so a second branch with no dedicated agent
    // user yet is a realistic (and deliberately unverified) fixture: it
    // exercises the admin "verify agency" flow (ADM-3) with zero listings.
    slug: 'blue-door-lettings',
    name: 'Blue Door Lettings',
    phone: '0118 977 6014',
    address: '3 Denmark Street, Wokingham, RG40 2BB',
    email: 'info@bluedoorlettings.co.uk',
    website: 'https://www.bluedoorlettings.co.uk',
    verified: false,
    createdByEmail: 'daniel.osei@cavershamkennetestates.co.uk',
  },
]

// ---------------------------------------------------------------------------
// Users
// ---------------------------------------------------------------------------

export const SEED_USERS: SeedUser[] = [
  {
    firebaseUid: 'seed-agent-priya-kapoor',
    email: 'priya.kapoor@thamesidepropertypartners.co.uk',
    displayName: 'Priya Kapoor',
    phone: '07700 900201',
    role: 'agent',
    agencySlug: 'thameside-property-partners',
    status: 'active',
  },
  {
    firebaseUid: 'seed-agent-daniel-osei',
    email: 'daniel.osei@cavershamkennetestates.co.uk',
    displayName: 'Daniel Osei',
    phone: '07700 900202',
    role: 'agent',
    agencySlug: 'caversham-kennet-estates',
    status: 'active',
  },
  {
    firebaseUid: 'seed-owner-david-whitfield',
    email: 'david.whitfield@example.co.uk',
    displayName: 'David Whitfield',
    phone: '07700 900203',
    role: 'owner',
    agencySlug: null,
    status: 'active',
  },
  {
    firebaseUid: 'seed-user-sarah-coates',
    email: 'sarah.coates@example.co.uk',
    displayName: 'Sarah Coates',
    phone: null,
    role: 'user',
    agencySlug: null,
    status: 'active',
  },
]

// ---------------------------------------------------------------------------
// Property images — a pure, deterministic generator rather than ~80
// hand-typed near-duplicate rows. Every input is a literal passed from a
// SeedProperty below, so output is identical on every run.
// ---------------------------------------------------------------------------

/** Real-shaped (base83) blurhash strings, cycled deterministically by
 * index. They don't decode to any particular seed image — a placeholder
 * only needs to be well-formed, not accurate. */
const BLURHASH_POOL: readonly string[] = [
  'L6PZfSi_.AyE_3t7t7R**0o#DgR4',
  'LKO2?U%2Tw=w]~RBVZRi};RPxuwH',
  'LEHLh[WB2yk8pyoJadR*.7kCMdnj',
  'LGFFaXYk^6#M@-5c,1J5@[or[Q6.',
  'L5H2EC=PM+yV0g-mq.wG9c010J}I',
]

const PHOTO_WIDTH = 1600
const PHOTO_HEIGHT = 1067
const FLOORPLAN_WIDTH = 1200
const FLOORPLAN_HEIGHT = 900

function buildPropertyImages(
  slug: string,
  title: string,
  photoCount: number,
  hasFloorplan: boolean,
): SeedPropertyImage[] {
  const images: SeedPropertyImage[] = []
  for (let i = 0; i < photoCount; i += 1) {
    images.push({
      kind: 'photo',
      storagePath: `https://picsum.photos/seed/${slug}-${i}/${PHOTO_WIDTH}/${PHOTO_HEIGHT}`,
      position: i,
      width: PHOTO_WIDTH,
      height: PHOTO_HEIGHT,
      blurhash: BLURHASH_POOL[i % BLURHASH_POOL.length]!,
      altText:
        i === 0 ? `Cover photo of ${title}` : `Photo ${i + 1} of ${title}`,
    })
  }
  if (hasFloorplan) {
    images.push({
      kind: 'floorplan',
      storagePath: `https://placehold.co/${FLOORPLAN_WIDTH}x${FLOORPLAN_HEIGHT}?text=Floorplan`,
      position: photoCount,
      width: FLOORPLAN_WIDTH,
      height: FLOORPLAN_HEIGHT,
      blurhash: BLURHASH_POOL[photoCount % BLURHASH_POOL.length]!,
      altText: `Floorplan of ${title}`,
    })
  }
  return images
}

// ---------------------------------------------------------------------------
// Properties
//
// 20 listings across the Reading/Thames Valley area: 12 sale, 8 rent; 15
// published, 3 under_offer, 1 pending_review, 1 draft (PRD §9.3 statuses).
// Coordinates are real-world approximations for each place, nudged to sit
// inside the bounding box used across the app for local dev (lat
// 51.40–51.55, lng -1.10 to -0.85). Only the draft listing (row 20, never
// submitted) has no images — every other status has passed the wizard's
// photo step (LST-2) at least once, including pending_review and
// under_offer, which is why they carry images too, not just `published`.
// ---------------------------------------------------------------------------

export const SEED_PROPERTIES: SeedProperty[] = [
  {
    slug: '2-bed-flat-reading-rg1',
    listerEmail: 'priya.kapoor@thamesidepropertypartners.co.uk',
    agencySlug: 'thameside-property-partners',
    channel: 'sale',
    status: 'published',
    propertyType: 'flat',
    title: '2 bed flat for sale',
    description:
      'A bright two-bedroom first-floor flat moments from Reading station, ' +
      'ideal for commuters. The open-plan living space leads onto a private ' +
      'balcony, and the building has secure entry and a lift.\n\n' +
      'Chain-free and ready to move into.',
    features: [
      'Private balcony',
      'Secure entry system',
      'Lift access',
      'Walking distance to Reading station',
      'Double glazing',
    ],
    bedrooms: 2,
    bathrooms: 1,
    price: 275_000,
    priceQualifier: 'fixed',
    tenure: 'leasehold',
    deposit: null,
    furnished: null,
    availableFrom: null,
    epcRating: 'C',
    councilTaxBand: 'C',
    addressLine1: '14 Vastern Court, Vastern Road',
    displayAddress: 'Vastern Road, Reading, RG1',
    town: 'Reading',
    outcode: 'RG1',
    postcode: 'RG1 8BU',
    location: { lat: 51.4614, lng: -0.9758 },
    locationApproximate: false,
    publishedAt: '2026-06-02T09:00:00Z',
    images: buildPropertyImages(
      '2-bed-flat-reading-rg1',
      '2 bed flat for sale',
      4,
      true,
    ),
  },
  {
    slug: '1-bed-flat-reading-rg1',
    listerEmail: 'david.whitfield@example.co.uk',
    agencySlug: null,
    channel: 'rent',
    status: 'published',
    propertyType: 'flat',
    title: '1 bed flat for rent',
    description:
      'A well-presented one-bedroom flat in central Reading, close to the ' +
      'Oracle shopping centre and Forbury Gardens. Modern kitchen with ' +
      'integrated appliances and a good-sized double bedroom.',
    features: [
      'Modern integrated kitchen',
      'Close to the Oracle',
      'Gas central heating',
      'Unfurnished',
    ],
    bedrooms: 1,
    bathrooms: 1,
    price: 1_100,
    priceQualifier: 'fixed',
    tenure: null,
    deposit: 1_269,
    furnished: 'unfurnished',
    availableFrom: '2026-09-01',
    epcRating: 'C',
    councilTaxBand: null,
    addressLine1: '6 Blagrave Street',
    displayAddress: 'Blagrave Street, Reading, RG1',
    town: 'Reading',
    outcode: 'RG1',
    postcode: 'RG1 1QB',
    location: { lat: 51.4571, lng: -0.9736 },
    locationApproximate: true,
    publishedAt: '2026-07-01T09:00:00Z',
    images: buildPropertyImages(
      '1-bed-flat-reading-rg1',
      '1 bed flat for rent',
      3,
      false,
    ),
  },
  {
    slug: '3-bed-semi-detached-house-caversham-rg4',
    listerEmail: 'daniel.osei@cavershamkennetestates.co.uk',
    agencySlug: 'caversham-kennet-estates',
    channel: 'sale',
    status: 'published',
    propertyType: 'semi_detached',
    title: '3 bed semi-detached house for sale',
    description:
      'A charming three-bedroom semi-detached family home in the heart of ' +
      'Caversham, within the catchment for well-regarded local schools. ' +
      'A recently fitted kitchen opens onto a south-facing garden.\n\n' +
      'Off-street parking for two cars.',
    features: [
      'South-facing garden',
      'Off-street parking',
      'Recently fitted kitchen',
      'Close to Caversham schools',
      'Gas central heating',
    ],
    bedrooms: 3,
    bathrooms: 1,
    price: 425_000,
    priceQualifier: 'guide_price',
    tenure: 'freehold',
    deposit: null,
    furnished: null,
    availableFrom: null,
    epcRating: null,
    councilTaxBand: 'D',
    addressLine1: '18 Priory Avenue',
    displayAddress: 'Priory Avenue, Caversham, Reading, RG4',
    town: 'Caversham',
    outcode: 'RG4',
    postcode: 'RG4 7SL',
    location: { lat: 51.4693, lng: -0.9739 },
    locationApproximate: false,
    publishedAt: '2026-05-18T09:00:00Z',
    images: buildPropertyImages(
      '3-bed-semi-detached-house-caversham-rg4',
      '3 bed semi-detached house for sale',
      4,
      true,
    ),
  },
  {
    slug: '2-bed-terraced-house-caversham-rg4',
    listerEmail: 'daniel.osei@cavershamkennetestates.co.uk',
    agencySlug: 'caversham-kennet-estates',
    channel: 'rent',
    status: 'published',
    propertyType: 'terraced',
    title: '2 bed terraced house for rent',
    description:
      'A neat two-bedroom terraced house on a quiet residential street in ' +
      'Caversham, with a low-maintenance rear courtyard garden and gas ' +
      'central heating throughout.',
    features: [
      'Rear courtyard garden',
      'Gas central heating',
      'Close to Caversham shops',
      'On-street permit parking',
    ],
    bedrooms: 2,
    bathrooms: 1,
    price: 1_450,
    priceQualifier: 'fixed',
    tenure: null,
    deposit: 1_673,
    furnished: 'unfurnished',
    availableFrom: '2026-08-25',
    epcRating: 'D',
    councilTaxBand: null,
    addressLine1: '22 Hemdean Road',
    displayAddress: 'Hemdean Road, Caversham, Reading, RG4',
    town: 'Caversham',
    outcode: 'RG4',
    postcode: 'RG4 7SW',
    location: { lat: 51.4732, lng: -0.981 },
    locationApproximate: false,
    publishedAt: '2026-06-28T09:00:00Z',
    images: buildPropertyImages(
      '2-bed-terraced-house-caversham-rg4',
      '2 bed terraced house for rent',
      4,
      false,
    ),
  },
  {
    slug: '4-bed-detached-house-earley-rg6',
    listerEmail: 'priya.kapoor@thamesidepropertypartners.co.uk',
    agencySlug: 'thameside-property-partners',
    channel: 'sale',
    status: 'under_offer',
    propertyType: 'detached',
    title: '4 bed detached house for sale',
    description:
      'A spacious four-bedroom detached house in a popular part of Earley, ' +
      'with a double garage, a landscaped garden and a recently extended ' +
      'kitchen-diner.\n\nSold subject to contract — register interest for ' +
      'similar properties.',
    features: [
      'Double garage',
      'Extended kitchen-diner',
      'Landscaped garden',
      'Ensuite to principal bedroom',
      'Close to Maiden Erlegh school',
    ],
    bedrooms: 4,
    bathrooms: 2,
    price: 595_000,
    priceQualifier: 'fixed',
    tenure: 'freehold',
    deposit: null,
    furnished: null,
    availableFrom: null,
    epcRating: null,
    councilTaxBand: 'F',
    addressLine1: '5 Silverdale Road',
    displayAddress: 'Silverdale Road, Earley, Reading, RG6',
    town: 'Earley',
    outcode: 'RG6',
    postcode: 'RG6 7JX',
    location: { lat: 51.4372, lng: -0.9345 },
    locationApproximate: false,
    publishedAt: '2026-04-10T09:00:00Z',
    images: buildPropertyImages(
      '4-bed-detached-house-earley-rg6',
      '4 bed detached house for sale',
      4,
      true,
    ),
  },
  {
    slug: 'studio-flat-earley-rg6',
    listerEmail: 'david.whitfield@example.co.uk',
    agencySlug: null,
    channel: 'rent',
    status: 'published',
    propertyType: 'flat',
    title: 'Studio flat for rent',
    description:
      'A compact, well-proportioned studio flat close to the University of ' +
      'Reading campus — ideal for a student or young professional. Bills ' +
      'not included.',
    features: [
      'Close to University of Reading',
      'Furnished',
      'Bike storage',
      'Double glazing',
    ],
    bedrooms: 0,
    bathrooms: 1,
    price: 950,
    priceQualifier: 'fixed',
    tenure: null,
    deposit: 1_096,
    furnished: 'furnished',
    availableFrom: '2026-09-15',
    epcRating: 'C',
    councilTaxBand: null,
    addressLine1: '2 Northumberland Avenue',
    displayAddress: 'Northumberland Avenue, Earley, Reading, RG6',
    town: 'Earley',
    outcode: 'RG6',
    postcode: 'RG6 1PT',
    location: { lat: 51.4401, lng: -0.9432 },
    locationApproximate: true,
    publishedAt: '2026-07-14T09:00:00Z',
    images: buildPropertyImages(
      'studio-flat-earley-rg6',
      'Studio flat for rent',
      3,
      false,
    ),
  },
  {
    slug: '3-bed-semi-detached-house-woodley-rg5',
    listerEmail: 'priya.kapoor@thamesidepropertypartners.co.uk',
    agencySlug: 'thameside-property-partners',
    channel: 'sale',
    status: 'published',
    propertyType: 'semi_detached',
    title: '3 bed semi-detached house for sale',
    description:
      'A well-maintained three-bedroom semi in Woodley, close to Loddon ' +
      'Valley leisure centre and with easy access to the A329(M). Driveway ' +
      'parking and a good-sized rear garden.',
    features: [
      'Driveway parking',
      'Good-sized rear garden',
      'Close to A329(M)',
      'Double glazing',
      'Gas central heating',
    ],
    bedrooms: 3,
    bathrooms: 1,
    price: 399_950,
    priceQualifier: 'fixed',
    tenure: 'freehold',
    deposit: null,
    furnished: null,
    availableFrom: null,
    epcRating: null,
    councilTaxBand: 'D',
    addressLine1: '11 Loddon Drive',
    displayAddress: 'Loddon Drive, Woodley, Reading, RG5',
    town: 'Woodley',
    outcode: 'RG5',
    postcode: 'RG5 4JT',
    location: { lat: 51.4514, lng: -0.8975 },
    locationApproximate: false,
    publishedAt: '2026-05-30T09:00:00Z',
    images: buildPropertyImages(
      '3-bed-semi-detached-house-woodley-rg5',
      '3 bed semi-detached house for sale',
      4,
      true,
    ),
  },
  {
    slug: '2-bed-flat-woodley-rg5',
    listerEmail: 'priya.kapoor@thamesidepropertypartners.co.uk',
    agencySlug: 'thameside-property-partners',
    channel: 'rent',
    status: 'published',
    propertyType: 'flat',
    title: '2 bed flat for rent',
    description:
      'A modern two-bedroom, two-bathroom flat in a well-kept development ' +
      'in Woodley, with allocated parking and a communal garden.',
    features: [
      'Allocated parking',
      'Communal garden',
      'Two bathrooms',
      'Part furnished',
    ],
    bedrooms: 2,
    bathrooms: 2,
    price: 1_250,
    priceQualifier: 'fixed',
    tenure: null,
    deposit: 1_442,
    furnished: 'part_furnished',
    availableFrom: '2026-08-20',
    epcRating: 'D',
    councilTaxBand: null,
    addressLine1: '4 Headley Road',
    displayAddress: 'Headley Road, Woodley, Reading, RG5',
    town: 'Woodley',
    outcode: 'RG5',
    postcode: 'RG5 3AN',
    location: { lat: 51.4489, lng: -0.9021 },
    locationApproximate: false,
    publishedAt: '2026-07-05T09:00:00Z',
    images: buildPropertyImages(
      '2-bed-flat-woodley-rg5',
      '2 bed flat for rent',
      3,
      false,
    ),
  },
  {
    slug: '3-bed-terraced-house-tilehurst-rg30',
    listerEmail: 'priya.kapoor@thamesidepropertypartners.co.uk',
    agencySlug: 'thameside-property-partners',
    channel: 'sale',
    status: 'published',
    propertyType: 'terraced',
    title: '3 bed terraced house for sale',
    description:
      'A three-bedroom Victorian terrace in Tilehurst with period features ' +
      'throughout, including a bay window and original fireplaces. A short ' +
      'walk from Tilehurst station.',
    features: [
      'Period features',
      'Bay window',
      'Close to Tilehurst station',
      'Low-maintenance garden',
    ],
    bedrooms: 3,
    bathrooms: 1,
    price: 310_000,
    priceQualifier: 'offers_over',
    tenure: 'freehold',
    deposit: null,
    furnished: null,
    availableFrom: null,
    epcRating: null,
    councilTaxBand: 'C',
    addressLine1: '31 Kentwood Hill',
    displayAddress: 'Kentwood Hill, Tilehurst, Reading, RG30',
    town: 'Tilehurst',
    outcode: 'RG30',
    postcode: 'RG30 4EG',
    location: { lat: 51.4557, lng: -1.0234 },
    locationApproximate: false,
    publishedAt: '2026-06-10T09:00:00Z',
    images: buildPropertyImages(
      '3-bed-terraced-house-tilehurst-rg30',
      '3 bed terraced house for sale',
      4,
      false,
    ),
  },
  {
    slug: '3-bed-terraced-house-tilehurst-rg31',
    listerEmail: 'daniel.osei@cavershamkennetestates.co.uk',
    agencySlug: 'caversham-kennet-estates',
    channel: 'rent',
    status: 'published',
    propertyType: 'terraced',
    title: '3 bed terraced house for rent',
    description:
      'A spacious three-bedroom terraced house in Calcot/Tilehurst, with a ' +
      'family bathroom, a separate downstairs WC and a private rear garden.',
    features: [
      'Private rear garden',
      'Separate downstairs WC',
      'Off-street parking for one car',
      'Unfurnished',
    ],
    bedrooms: 3,
    bathrooms: 1,
    price: 1_600,
    priceQualifier: 'fixed',
    tenure: null,
    deposit: 1_846,
    furnished: 'unfurnished',
    availableFrom: '2026-10-01',
    epcRating: 'E',
    councilTaxBand: null,
    addressLine1: '9 Chapel Hill',
    displayAddress: 'Chapel Hill, Tilehurst, Reading, RG31',
    town: 'Tilehurst',
    outcode: 'RG31',
    postcode: 'RG31 6XY',
    location: { lat: 51.4523, lng: -1.0389 },
    locationApproximate: false,
    publishedAt: '2026-07-08T09:00:00Z',
    images: buildPropertyImages(
      '3-bed-terraced-house-tilehurst-rg31',
      '3 bed terraced house for rent',
      3,
      false,
    ),
  },
  {
    slug: '4-bed-detached-house-lower-earley-rg6',
    listerEmail: 'priya.kapoor@thamesidepropertypartners.co.uk',
    agencySlug: 'thameside-property-partners',
    channel: 'sale',
    status: 'published',
    propertyType: 'detached',
    title: '4 bed detached house for sale',
    description:
      'A modern four-bedroom detached family home in Lower Earley, built in ' +
      'the last decade, with an integral garage, ensuite and a private ' +
      'south-west-facing garden backing onto woodland.',
    features: [
      'Integral garage',
      'Ensuite to principal bedroom',
      'South-west-facing garden',
      'Backs onto woodland',
      'Close to Maiden Erlegh Lake',
    ],
    bedrooms: 4,
    bathrooms: 3,
    price: 475_000,
    priceQualifier: 'offers_in_region',
    tenure: 'freehold',
    deposit: null,
    furnished: null,
    availableFrom: null,
    epcRating: null,
    councilTaxBand: 'E',
    addressLine1: '7 Chalfont Way',
    displayAddress: 'Chalfont Way, Lower Earley, Reading, RG6',
    town: 'Lower Earley',
    outcode: 'RG6',
    postcode: 'RG6 5UZ',
    location: { lat: 51.4249, lng: -0.927 },
    locationApproximate: false,
    publishedAt: '2026-05-22T09:00:00Z',
    images: buildPropertyImages(
      '4-bed-detached-house-lower-earley-rg6',
      '4 bed detached house for sale',
      4,
      true,
    ),
  },
  {
    slug: '2-bed-maisonette-lower-earley-rg6',
    listerEmail: 'daniel.osei@cavershamkennetestates.co.uk',
    agencySlug: 'caversham-kennet-estates',
    channel: 'rent',
    status: 'under_offer',
    propertyType: 'maisonette',
    title: '2 bed maisonette for rent',
    description:
      'A two-bedroom maisonette over two floors in Lower Earley, with its ' +
      'own private entrance and a small enclosed garden. Let agreed.',
    features: [
      'Private entrance',
      'Enclosed garden',
      'Furnished',
      'Close to Lower Earley Way',
    ],
    bedrooms: 2,
    bathrooms: 1,
    price: 1_150,
    priceQualifier: 'fixed',
    tenure: null,
    deposit: 1_327,
    furnished: 'furnished',
    availableFrom: '2026-08-11',
    epcRating: 'C',
    councilTaxBand: null,
    addressLine1: '3 Chalgrove Way',
    displayAddress: 'Chalgrove Way, Lower Earley, Reading, RG6',
    town: 'Lower Earley',
    outcode: 'RG6',
    postcode: 'RG6 5TG',
    location: { lat: 51.4211, lng: -0.9312 },
    locationApproximate: false,
    publishedAt: '2026-06-19T09:00:00Z',
    images: buildPropertyImages(
      '2-bed-maisonette-lower-earley-rg6',
      '2 bed maisonette for rent',
      3,
      false,
    ),
  },
  {
    slug: '5-bed-detached-house-sonning-rg4',
    listerEmail: 'daniel.osei@cavershamkennetestates.co.uk',
    agencySlug: 'caversham-kennet-estates',
    channel: 'sale',
    status: 'published',
    propertyType: 'detached',
    title: '5 bed detached house for sale',
    description:
      'An impressive five-bedroom detached house in the sought-after ' +
      'village of Sonning, moments from the River Thames, with a large ' +
      'garden, a triple garage and a newly fitted kitchen-breakfast room.\n\n' +
      'Viewing strongly recommended.',
    features: [
      'Triple garage',
      'Large garden',
      'Newly fitted kitchen',
      'Moments from the River Thames',
      'Sought-after village location',
    ],
    bedrooms: 5,
    bathrooms: 3,
    price: 849_950,
    priceQualifier: 'guide_price',
    tenure: 'freehold',
    deposit: null,
    furnished: null,
    availableFrom: null,
    epcRating: null,
    councilTaxBand: 'H',
    addressLine1: 'Thames View, Sonning Lane',
    displayAddress: 'Sonning Lane, Sonning, Reading, RG4',
    town: 'Sonning',
    outcode: 'RG4',
    postcode: 'RG4 6UR',
    location: { lat: 51.4779, lng: -0.9089 },
    locationApproximate: false,
    publishedAt: '2026-03-25T09:00:00Z',
    images: buildPropertyImages(
      '5-bed-detached-house-sonning-rg4',
      '5 bed detached house for sale',
      4,
      true,
    ),
  },
  {
    slug: '3-bed-semi-detached-house-twyford-rg10',
    listerEmail: 'daniel.osei@cavershamkennetestates.co.uk',
    agencySlug: 'caversham-kennet-estates',
    channel: 'sale',
    status: 'published',
    propertyType: 'semi_detached',
    title: '3 bed semi-detached house for sale',
    description:
      'A well-presented three-bedroom semi-detached house in Twyford, a ' +
      'short walk from the mainline station with fast trains to London ' +
      'Paddington. Off-street parking and a westerly-facing garden.',
    features: [
      'Off-street parking',
      'Westerly-facing garden',
      'Walk to Twyford station',
      'Gas central heating',
    ],
    bedrooms: 3,
    bathrooms: 2,
    price: 450_000,
    priceQualifier: 'fixed',
    tenure: 'freehold',
    deposit: null,
    furnished: null,
    availableFrom: null,
    epcRating: null,
    councilTaxBand: 'E',
    addressLine1: '16 Wargrave Road',
    displayAddress: 'Wargrave Road, Twyford, Reading, RG10',
    town: 'Twyford',
    outcode: 'RG10',
    postcode: 'RG10 9BG',
    location: { lat: 51.4776, lng: -0.8622 },
    locationApproximate: false,
    publishedAt: '2026-05-05T09:00:00Z',
    images: buildPropertyImages(
      '3-bed-semi-detached-house-twyford-rg10',
      '3 bed semi-detached house for sale',
      4,
      true,
    ),
  },
  {
    slug: '2-bed-flat-twyford-rg10',
    listerEmail: 'daniel.osei@cavershamkennetestates.co.uk',
    agencySlug: 'caversham-kennet-estates',
    channel: 'rent',
    status: 'published',
    propertyType: 'flat',
    title: '2 bed flat for rent',
    description:
      'A two-bedroom first-floor flat in a converted period building close ' +
      'to Twyford village centre, with a private parking space and a ' +
      'shared garden.',
    features: [
      'Private parking space',
      'Shared garden',
      'Period conversion',
      'Close to Twyford station',
    ],
    bedrooms: 2,
    bathrooms: 1,
    price: 1_350,
    priceQualifier: 'fixed',
    tenure: null,
    deposit: 1_558,
    furnished: 'unfurnished',
    availableFrom: '2026-09-05',
    epcRating: 'D',
    councilTaxBand: null,
    addressLine1: '2a Station Road',
    displayAddress: 'Station Road, Twyford, Reading, RG10',
    town: 'Twyford',
    outcode: 'RG10',
    postcode: 'RG10 9NX',
    location: { lat: 51.4801, lng: -0.8577 },
    locationApproximate: false,
    publishedAt: '2026-07-12T09:00:00Z',
    images: buildPropertyImages(
      '2-bed-flat-twyford-rg10',
      '2 bed flat for rent',
      3,
      false,
    ),
  },
  {
    slug: '4-bed-detached-house-wokingham-rg41',
    listerEmail: 'priya.kapoor@thamesidepropertypartners.co.uk',
    agencySlug: 'thameside-property-partners',
    channel: 'sale',
    status: 'published',
    propertyType: 'detached',
    title: '4 bed detached house for sale',
    description:
      'A substantial four-bedroom detached house on a private road in ' +
      'Wokingham, with a double garage, a home office and a landscaped ' +
      'south-facing garden.',
    features: [
      'Double garage',
      'Home office',
      'South-facing garden',
      'Private road',
      'Close to Wokingham town centre',
    ],
    bedrooms: 4,
    bathrooms: 2,
    price: 625_000,
    priceQualifier: 'fixed',
    tenure: 'freehold',
    deposit: null,
    furnished: null,
    availableFrom: null,
    epcRating: null,
    councilTaxBand: 'F',
    addressLine1: '21 Norreys Avenue',
    displayAddress: 'Norreys Avenue, Wokingham, RG41',
    town: 'Wokingham',
    outcode: 'RG41',
    postcode: 'RG41 2QG',
    location: { lat: 51.413, lng: -0.865 },
    locationApproximate: false,
    publishedAt: '2026-06-15T09:00:00Z',
    images: buildPropertyImages(
      '4-bed-detached-house-wokingham-rg41',
      '4 bed detached house for sale',
      4,
      true,
    ),
  },
  {
    slug: '3-bed-terraced-house-henley-on-thames-rg9',
    listerEmail: 'daniel.osei@cavershamkennetestates.co.uk',
    agencySlug: 'caversham-kennet-estates',
    channel: 'sale',
    status: 'under_offer',
    propertyType: 'terraced',
    title: '3 bed terraced house for sale',
    description:
      'A characterful three-bedroom cottage in the centre of Henley-on-' +
      'Thames, a short stroll from the river and the town’s shops and ' +
      'restaurants. Sold subject to contract.',
    features: [
      'Central Henley location',
      'Short stroll to the river',
      'Period character',
      'Courtyard garden',
    ],
    bedrooms: 3,
    bathrooms: 2,
    price: 695_000,
    priceQualifier: 'guide_price',
    tenure: 'freehold',
    deposit: null,
    furnished: null,
    availableFrom: null,
    epcRating: null,
    councilTaxBand: 'F',
    addressLine1: '4 Friday Street',
    displayAddress: 'Friday Street, Henley-on-Thames, RG9',
    town: 'Henley-on-Thames',
    outcode: 'RG9',
    postcode: 'RG9 1AY',
    location: { lat: 51.5363, lng: -0.8987 },
    locationApproximate: false,
    publishedAt: '2026-04-28T09:00:00Z',
    images: buildPropertyImages(
      '3-bed-terraced-house-henley-on-thames-rg9',
      '3 bed terraced house for sale',
      4,
      true,
    ),
  },
  {
    slug: '1-bed-flat-henley-on-thames-rg9',
    listerEmail: 'priya.kapoor@thamesidepropertypartners.co.uk',
    agencySlug: 'thameside-property-partners',
    channel: 'rent',
    status: 'published',
    propertyType: 'flat',
    title: '1 bed flat for rent',
    description:
      'A stylish one-bedroom flat in Henley-on-Thames, recently ' +
      'refurbished, with a private balcony overlooking the town.',
    features: [
      'Recently refurbished',
      'Private balcony',
      'Furnished',
      'Close to Henley station',
    ],
    bedrooms: 1,
    bathrooms: 1,
    price: 1_395,
    priceQualifier: 'fixed',
    tenure: null,
    deposit: 1_610,
    furnished: 'furnished',
    availableFrom: '2026-08-18',
    epcRating: 'B',
    councilTaxBand: null,
    addressLine1: '11 Reading Road',
    displayAddress: 'Reading Road, Henley-on-Thames, RG9',
    town: 'Henley-on-Thames',
    outcode: 'RG9',
    postcode: 'RG9 1DP',
    location: { lat: 51.5341, lng: -0.9012 },
    locationApproximate: false,
    publishedAt: '2026-07-20T09:00:00Z',
    images: buildPropertyImages(
      '1-bed-flat-henley-on-thames-rg9',
      '1 bed flat for rent',
      3,
      false,
    ),
  },
  {
    slug: '2-bed-terraced-house-reading-rg1',
    listerEmail: 'david.whitfield@example.co.uk',
    agencySlug: null,
    channel: 'sale',
    status: 'pending_review',
    propertyType: 'terraced',
    title: '2 bed terraced house for sale',
    description:
      'A two-bedroom terraced house close to central Reading, being sold by ' +
      'the family following a bereavement. In need of some modernisation ' +
      'but with plenty of potential.',
    features: [
      'Close to central Reading',
      'No onward chain',
      'Scope to modernise',
      'Rear garden',
    ],
    bedrooms: 2,
    bathrooms: 1,
    price: 260_000,
    priceQualifier: 'fixed',
    tenure: 'freehold',
    deposit: null,
    furnished: null,
    availableFrom: null,
    epcRating: null,
    councilTaxBand: 'B',
    addressLine1: '58 Elm Road',
    displayAddress: 'Elm Road, Reading, RG1',
    town: 'Reading',
    outcode: 'RG1',
    postcode: 'RG1 4EH',
    location: { lat: 51.4602, lng: -0.9612 },
    locationApproximate: true,
    // Not yet published — awaiting the moderation queue (ADM-1).
    publishedAt: null,
    images: buildPropertyImages(
      '2-bed-terraced-house-reading-rg1',
      '2 bed terraced house for sale',
      3,
      false,
    ),
  },
  {
    slug: '3-bed-bungalow-caversham-rg4',
    listerEmail: 'david.whitfield@example.co.uk',
    agencySlug: null,
    channel: 'sale',
    status: 'draft',
    propertyType: 'bungalow',
    title: '3 bed bungalow for sale',
    description:
      'A three-bedroom detached bungalow in Emmer Green, Caversham, with a ' +
      'generous plot and scope for extension (subject to planning). Still ' +
      'being prepared for submission.',
    features: [
      'Generous plot',
      'Scope to extend, subject to planning',
      'Off-street parking',
    ],
    bedrooms: 3,
    bathrooms: 1,
    price: 445_000,
    priceQualifier: 'fixed',
    // Tenure not yet confirmed by the lister — realistic for a draft that
    // has not reached the details step's full validation (LST-2 step 3).
    tenure: 'unknown',
    deposit: null,
    furnished: null,
    availableFrom: null,
    epcRating: null,
    councilTaxBand: null,
    addressLine1: '9 Kidmore Road',
    displayAddress: 'Kidmore Road, Emmer Green, Caversham, RG4',
    town: 'Caversham',
    outcode: 'RG4',
    postcode: 'RG4 8SD',
    location: { lat: 51.485, lng: -0.9698 },
    locationApproximate: true,
    // Never submitted, so never published.
    publishedAt: null,
    // Draft: hasn't reached the wizard's photo step (LST-2 step 5) yet.
    images: [],
  },
]
