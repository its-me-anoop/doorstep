/**
 * services/saved/ — favourites and saved searches (PRD §6.3 ACC-2).
 */

export { SaveProperty } from './save-property'
export { UnsaveProperty } from './unsave-property'
export {
  ListSavedProperties,
  type SavedPropertyCard,
  type SavedPropertyWithListing,
} from './list-saved-properties'
export { SaveSearch } from './save-search'
export { ListSavedSearches } from './list-saved-searches'
export { DeleteSavedSearch } from './delete-saved-search'
export { SavedListingNotFoundError, SavedSearchForbiddenError } from './errors'
