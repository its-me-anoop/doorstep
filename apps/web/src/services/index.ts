/**
 * services/
 *
 * Use cases (PublishListing, SubmitEnquiry, ApproveListing, ...) that
 * orchestrate one or more ports to fulfil a single application action. Each
 * service has one responsibility (SRP). Services depend only on port
 * interfaces (DIP) — never on adapters/ or framework types — so they can be
 * unit tested with in-memory fakes.
 *
 * See PRD §8.5.
 */
export {}
