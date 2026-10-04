import type { SushiRestaurant } from './session'

/**
 * Restaurants Harn knows the prices of, ready to pick.
 *
 * **Empty on purpose.** A preset puts a real restaurant's name next to a price,
 * and people trust that pairing even with a confirm step in front of it — so an
 * entry only belongs here once its prices come from that restaurant's own menu
 * or a receipt, not from an example. Until then, "Other" starts with the usual
 * four plate colours and blank prices, and a restaurant somebody has typed in
 * can be saved for next time.
 *
 * Kept as plain data, apart from the calculation, so it can move to an API later
 * without anything else changing shape.
 */
export const PRESET_RESTAURANTS: SushiRestaurant[] = []
