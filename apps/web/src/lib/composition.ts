/**
 * lib/composition.ts — the composition root.
 *
 * This is the one place allowed to import concrete adapters (adapters/*)
 * and wire them into ports (ports/), then hand the resulting services
 * (services/) to callers. Route handlers and server components call
 * `createServices()` and depend on the returned shape, never on an
 * adapter directly (DIP). The ESLint config in this package enforces
 * that boundary: app/** may not import from adapters/** except through
 * this file.
 *
 * Nothing is wired yet — later milestones add a concrete adapter per
 * port here as each integration (Drizzle, Meilisearch, Firebase, Resend,
 * Mapbox, Upstash) lands. See PRD §8.5.
 */

// Grows into `{ listings: PublishListingService, enquiries: SubmitEnquiryService, ... }`
// as each service lands. Empty for now because there are no services yet.
export type Services = Record<string, never>

export function createServices(): Services {
  return {}
}
