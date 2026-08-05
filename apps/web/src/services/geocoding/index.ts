/**
 * services/geocoding/
 *
 * GET /api/v1/geocode's use case (PRD §10, §8.6): SearchGeocode. See that
 * file's doc comment for why this is a one-file, one-class directory
 * (no authz, no domain errors) unlike services/listings/.
 */

export { SearchGeocode } from './search-geocode'
