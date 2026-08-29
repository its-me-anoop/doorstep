import type { GeoPoint } from '@/domain/property'

interface LocationSectionProps {
  /** Never `addressLine1` — DET-3's privacy rule (PRD §9.2). */
  displayAddress: string
  geo: GeoPoint
  /** When true the pin is already shifted in storage (§5.6). */
  locationApproximate?: boolean
}

function buildOsmEmbedUrl(geo: GeoPoint, approximate: boolean): string {
  const pad = approximate ? 0.02 : 0.008
  const { lat, lng } = geo
  const bbox = `${lng - pad},${lat - pad},${lng + pad},${lat + pad}`
  const marker = `${lat}%2C${lng}`
  return `https://www.openstreetmap.org/export/embed.html?bbox=${encodeURIComponent(bbox)}&layer=mapnik&marker=${marker}`
}

function buildOsmViewUrl(geo: GeoPoint): string {
  const { lat, lng } = geo
  return `https://www.openstreetmap.org/?mlat=${lat}&mlon=${lng}#map=15/${lat}/${lng}`
}

/**
 * LocationSection — M2-DESIGN-SPEC.md §5.6. A lightweight OpenStreetMap
 * embed shows the listing pin without pulling MapLibre/Mapbox into the
 * detail bundle (PRD §7.1). Approximate listings use a slightly wider
 * bbox; the stored coordinates are already privacy-shifted server-side.
 */
export function LocationSection({
  displayAddress,
  geo,
  locationApproximate = false,
}: LocationSectionProps) {
  const embedUrl = buildOsmEmbedUrl(geo, locationApproximate)
  const viewUrl = buildOsmViewUrl(geo)

  return (
    <section className="flex flex-col gap-4">
      <h2 className="text-foreground text-[length:var(--text-h3)]">
        Location.
      </h2>
      <p className="text-foreground text-base font-medium">{displayAddress}</p>
      {locationApproximate ? (
        <p className="text-muted-foreground text-sm">
          Map shows an approximate location for privacy.
        </p>
      ) : null}
      <div className="border-border aspect-[16/9] w-full overflow-hidden rounded-[var(--radius-md)] border">
        <iframe
          title="Property location map"
          src={embedUrl}
          className="h-full w-full border-0"
          loading="lazy"
          referrerPolicy="no-referrer-when-downgrade"
        />
      </div>
      <p className="text-sm">
        <a
          href={viewUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="text-primary font-medium hover:underline"
        >
          View larger map on OpenStreetMap
        </a>
      </p>
    </section>
  )
}
