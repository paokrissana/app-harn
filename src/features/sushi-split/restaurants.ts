import type { SushiRestaurant } from './session'

/**
 * Conveyor-belt sushi restaurants in Thailand, ready to pick — **by name only**.
 *
 * Every entry has an empty price list on purpose. A built-in price puts a real
 * restaurant's name next to a number, and people trust that pairing even with a
 * confirm step in front of it; prices also differ by branch and change without
 * notice. So picking one of these fills in the name and the usual plate colours,
 * leaves the prices blank to copy from the menu, and lets the diner save *their*
 * prices against the restaurant for next time.
 *
 * A price belongs here only once it comes from the restaurant's own menu or a
 * receipt — and then it would be a branch's price, with a date, not "the" price.
 *
 * Kept in alphabetical order, as plain data apart from the calculation, so it can
 * move to an API later without anything else changing shape.
 */
export const PRESET_RESTAURANTS: SushiRestaurant[] = [
  { id: 'katsu-midori-sushi', name: 'Katsu Midori Sushi', pricing: [] },
  { id: 'shinkanzen-sushi', name: 'Shinkanzen Sushi', pricing: [] },
  { id: 'sushiro', name: 'Sushiro', pricing: [] },
]
