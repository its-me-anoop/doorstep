/**
 * Kebab-case slug generation shared by anything that derives a URL path
 * segment from free text — agencies today (PRD §6.5 LST-1,
 * services/listers/create-agency.ts); the M1 create-listing wizard's own
 * slug field (PRD §6.5 LST-2) is expected to reuse this. Pure and
 * framework-free, so it lives in domain/ per PRD §8.5.
 */
export function slugify(input: string): string {
  return input
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '') // strip combining accents left by NFKD
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
}
