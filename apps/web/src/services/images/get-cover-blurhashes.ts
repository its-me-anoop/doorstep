/**
 * GetCoverBlurhashes — resolves each listing's cover image blurhash (the
 * position-0 `property_images` row's `blurhash` column) for the
 * my-listings dashboard's row thumbnails (M1-DESIGN-SPEC.md §4.2:
 * "blurhash placeholder until the real cover loads"; §1.5's tile
 * anatomy). No actor/authz parameter, unlike every other services/images/*
 * use case: the listing ids passed in are ones the caller (the dashboard
 * page, via ListMyListings) has already resolved through an authorised
 * read, so this is a pure display-data lookup over ids the actor is
 * already known to be allowed to see, not a new authorization boundary
 * of its own.
 *
 * Deliberately blurhash-only, not the full resolved photo URL
 * (attach-image-urls.ts's job, used one listing at a time by the wizard's
 * editor view): ImageStorage.publicUrl makes a live network call to
 * Firebase Storage per variant (ports/image-storage.ts's own doc
 * comment), which does not belong on a list page's render path for up to
 * a page's worth of rows without a caching layer this milestone doesn't
 * build. The blurhash needs no such call — it's a plain column already on
 * the property_images row — so it is the one piece of "what does this
 * listing's cover look like" this service resolves for M1. Wiring the
 * crisp photo in behind a CDN/cache is a tracked follow-up, not an
 * oversight.
 */

import type { PropertyImageReader } from '@/ports/property-image-repository'

export class GetCoverBlurhashes {
  constructor(private readonly propertyImageReader: PropertyImageReader) {}

  /** Only ids with at least one image (specifically one at position 0,
   * PRD §9.2's "position 0 = cover") appear in the returned map — a
   * listing with no photos yet simply has no entry, which callers read
   * as "show the flat no-photo tile" rather than a sentinel value. */
  async execute(listingIds: readonly string[]): Promise<Map<string, string>> {
    const entries = await Promise.all(
      listingIds.map(async (id) => {
        const images = await this.propertyImageReader.listByProperty(id)
        const cover = images.find((image) => image.position === 0)
        return [id, cover?.blurhash] as const
      }),
    )

    return new Map(
      entries.filter(
        (entry): entry is [string, string] => entry[1] !== undefined,
      ),
    )
  }
}
