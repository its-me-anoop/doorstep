const STATEMENTS = [
  {
    heading: 'Every listing, checked by a person.',
    body: 'No scraped feeds, no fake urgency banners. An admin reviews every home before it goes live, usually within a day.',
    marginTop: 'mt-8',
    offset: '',
  },
  {
    heading: 'Built for Reading, not bolted on.',
    body: 'Search, filters and area pages are tuned to how this town is actually searched — Caversham versus Reading town centre, RG postcodes, cycling distance to the station.',
    marginTop: 'mt-8 md:mt-12',
    offset: 'md:ml-6',
  },
  {
    heading: 'Open to private sellers and landlords.',
    body: "David selling his mother's house or letting a spare flat doesn't need an agent to get a fair hearing here — the incumbents won't let him list at all.",
    marginTop: 'mt-8',
    offset: '',
  },
] as const

/**
 * An editorial running list, not an icon-card grid — deliberately
 * uneven top margins (32/48/32px) create rhythm on desktop; mobile
 * collapses to a uniform 32px gap (DESIGN-SPEC.md §3.3).
 */
export function ValuePropositionSection() {
  return (
    <section className="px-5 py-16 sm:px-8 md:py-24 lg:px-16">
      <div className="mx-auto max-w-[1200px]">
        <h2 className="text-muted-foreground text-xs font-semibold tracking-[0.04em] uppercase">
          Why Doorstep
        </h2>
        {STATEMENTS.map((statement) => (
          <div
            key={statement.heading}
            className={`${statement.marginTop} ${statement.offset} max-w-[60ch]`}
          >
            <h3 className="text-foreground text-[length:var(--text-h3)] leading-[1.3]">
              {statement.heading}
            </h3>
            <p className="text-muted-foreground mt-2 text-[length:var(--text-base)] leading-relaxed">
              {statement.body}
            </p>
          </div>
        ))}
      </div>
    </section>
  )
}
