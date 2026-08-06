import Link from 'next/link'

export interface BreadcrumbItem {
  label: string
  /** Omitted on the final crumb — non-linked, `text-foreground` (§3.1). */
  href?: string
}

interface BreadcrumbProps {
  items: BreadcrumbItem[]
}

/**
 * Breadcrumb — §3.1 point 1. The visible trail doubles as the
 * `BreadcrumbList` JSON-LD (PRD §7.2): one `items` array feeds both, so
 * they can never drift out of sync.
 */
export function Breadcrumb({ items }: BreadcrumbProps) {
  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: items.map((item, index) => ({
      '@type': 'ListItem',
      position: index + 1,
      name: item.label,
      ...(item.href ? { item: item.href } : {}),
    })),
  }

  return (
    <>
      <nav aria-label="Breadcrumb" className="text-muted-foreground text-sm">
        {items.map((item, index) => {
          const isLast = index === items.length - 1
          return (
            <span key={`${item.label}-${index}`}>
              {index > 0 && <span aria-hidden="true"> / </span>}
              {item.href && !isLast ? (
                <Link href={item.href} className="hover:text-foreground">
                  {item.label}
                </Link>
              ) : (
                <span
                  className="text-foreground"
                  aria-current={isLast ? 'page' : undefined}
                >
                  {item.label}
                </span>
              )}
            </span>
          )
        })}
      </nav>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />
    </>
  )
}
