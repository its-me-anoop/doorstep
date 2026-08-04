const NEIGHBOURHOODS = [
  'Caversham',
  'Tilehurst',
  'Earley',
  'Woodley',
  'Wokingham',
  'Emmer Green',
  'Reading town centre',
]

/**
 * Asymmetric 40/60 split. The neighbourhood list is set-in-type running
 * text — never chips, never a tag cloud (DESIGN-SPEC.md §3.4).
 */
export function ReadingFocusSection() {
  return (
    <section className="bg-card px-5 py-16 sm:px-8 md:py-24 lg:px-16">
      <div className="mx-auto grid max-w-[1200px] gap-10 md:grid-cols-[40fr_60fr] md:gap-16">
        <div>
          <h2 className="text-foreground text-[length:var(--text-h2)] leading-[1.2]">
            Starting local, on purpose.
          </h2>
          <p className="text-muted-foreground mt-4 max-w-[46ch] text-[length:var(--text-base)] leading-relaxed">
            Property portals win on how many homes they list. We&rsquo;re not
            trying to beat that game nationally on day one — we&rsquo;re proving
            it works in one place first: Reading and the Thames Valley.
          </p>
        </div>
        <p className="text-foreground text-[length:var(--text-lead)] leading-[1.8]">
          {NEIGHBOURHOODS.map((name) => (
            <span key={name}>
              <span className="text-primary">{name}</span>
              {'. '}
            </span>
          ))}
        </p>
      </div>
    </section>
  )
}
