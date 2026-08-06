import type {
  Channel,
  CouncilTaxBand,
  EpcRating,
  Furnished,
  PriceQualifier,
  PropertyType,
  Tenure,
} from '@/domain/enums'
import { formatPrice } from '@/domain/money'
import {
  FURNISHED_LABELS,
  PROPERTY_TYPE_LABELS,
  TENURE_LABELS,
} from '@/components/features/listings/wizard/wizard-labels'
import { formatIsoDateLong } from '@/lib/format-date'

interface KeyFactsProps {
  channel: Channel
  price: number
  priceQualifier: PriceQualifier
  bedrooms: number
  bathrooms: number
  propertyType: PropertyType
  /** Sale only — omitted (not rendered) when null. */
  tenure: Tenure | null
  /** Rent only — omitted when null. */
  furnished: Furnished | null
  /** Rent only, `YYYY-MM-DD` — omitted when null. */
  availableFrom: string | null
  epcRating: EpcRating | null
  councilTaxBand: CouncilTaxBand | null
  /** `YYYY-MM-DD` "today," for the Available-from "Now" comparison —
   * threaded in rather than read from `Date.now()` so this stays a pure,
   * server/client-agreeing component (same reasoning as ResultsView's
   * `now` prop, §1.11). */
  todayIso: string
}

interface FactRow {
  key: string
  label: string
  value: string
}

function bedroomsValue(bedrooms: number): string {
  return bedrooms === 0 ? 'Studio' : String(bedrooms)
}

function availableFromValue(availableFrom: string, todayIso: string): string {
  return availableFrom <= todayIso ? 'Now' : formatIsoDateLong(availableFrom)
}

function buildRows(props: KeyFactsProps): FactRow[] {
  const rows: FactRow[] = [
    {
      key: 'price',
      label: props.channel === 'sale' ? 'Price' : 'Rent',
      value: formatPrice({
        channel: props.channel,
        price: props.price,
        priceQualifier: props.priceQualifier,
      }),
    },
    {
      key: 'bedrooms',
      label: 'Bedrooms',
      value: bedroomsValue(props.bedrooms),
    },
    { key: 'bathrooms', label: 'Bathrooms', value: String(props.bathrooms) },
    {
      key: 'type',
      label: 'Type',
      value: PROPERTY_TYPE_LABELS[props.propertyType],
    },
  ]

  if (props.channel === 'sale' && props.tenure) {
    rows.push({
      key: 'tenure',
      label: 'Tenure',
      value: TENURE_LABELS[props.tenure],
    })
  }
  if (props.channel === 'rent' && props.furnished) {
    rows.push({
      key: 'furnished',
      label: 'Furnished',
      value: FURNISHED_LABELS[props.furnished],
    })
  }
  if (props.channel === 'rent' && props.availableFrom) {
    rows.push({
      key: 'availableFrom',
      label: 'Available from',
      value: availableFromValue(props.availableFrom, props.todayIso),
    })
  }
  if (props.epcRating) {
    rows.push({ key: 'epc', label: 'EPC rating', value: props.epcRating })
  }
  if (props.councilTaxBand) {
    rows.push({
      key: 'councilTax',
      label: 'Council tax band',
      value: props.councilTaxBand,
    })
  }

  return rows
}

/**
 * KeyFacts — M2-DESIGN-SPEC.md §5.4. Plain two-column definition list
 * (not a bordered card — this is page-background content, consistent
 * with "not everything is a card"), channel-aware row set. Grid
 * auto-flow places each `<dt>`/`<dd>` pair as one row across the 2-column
 * track, so the DOM order below (label immediately before its value) is
 * both semantically correct and visually correct with no extra wrapper.
 */
export function KeyFacts(props: KeyFactsProps) {
  const rows = buildRows(props)

  return (
    <dl className="grid grid-cols-1 gap-x-6 gap-y-3 sm:grid-cols-2">
      {rows.map((row) => (
        <Row key={row.key} label={row.label} value={row.value} />
      ))}
    </dl>
  )
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <>
      <dt className="text-muted-foreground text-sm">{label}</dt>
      <dd className="text-foreground text-base font-medium">{value}</dd>
    </>
  )
}
