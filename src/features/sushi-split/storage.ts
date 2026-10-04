import {
  PLATE_COLORS,
  type Diner,
  type PlateType,
  type SushiRestaurant,
  type SushiSession,
} from './session'

/**
 * Two things kept on this device, and nothing else: restaurants somebody has
 * typed in and chosen to keep, and the session in progress.
 *
 * Both are conveniences. Anything unreadable — corrupt JSON, an older shape, a
 * browser that refuses storage — is treated as "nothing saved" rather than an
 * error, since the split works perfectly well without either.
 */

const RESTAURANTS_KEY = 'sushi-restaurants'
const SESSION_KEY = 'sushi-session'
const VERSION = 1

interface Stored<T> {
  version: number
  data: T
}

function read<T>(key: string, accept: (value: unknown) => value is T): T | null {
  try {
    const raw = localStorage.getItem(key)
    if (!raw) return null

    const parsed = JSON.parse(raw) as Stored<unknown>
    if (parsed?.version !== VERSION) return null
    return accept(parsed.data) ? parsed.data : null
  } catch {
    return null
  }
}

function write<T>(key: string, data: T): void {
  try {
    localStorage.setItem(key, JSON.stringify({ version: VERSION, data }))
  } catch {
    // Out of quota or private mode: worth a shrug, not a crash.
  }
}

const isObject = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null

const isColor = (value: unknown) =>
  value === null || PLATE_COLORS.includes(value as never)

function isRestaurant(value: unknown): value is SushiRestaurant {
  return (
    isObject(value) &&
    typeof value.id === 'string' &&
    typeof value.name === 'string' &&
    Array.isArray(value.pricing) &&
    value.pricing.every(
      (plate) =>
        isObject(plate) &&
        typeof plate.id === 'string' &&
        typeof plate.label === 'string' &&
        typeof plate.price === 'number' &&
        isColor(plate.color),
    )
  )
}

const isRestaurantList = (value: unknown): value is SushiRestaurant[] =>
  Array.isArray(value) && value.every(isRestaurant)

/** The restaurants somebody chose to keep. */
export function loadRestaurants(): SushiRestaurant[] {
  return read(RESTAURANTS_KEY, isRestaurantList) ?? []
}

/**
 * Keep a restaurant for next time. One with the same id is replaced rather than
 * duplicated, so saving again after changing a price updates it.
 *
 * Saving never touches a session that is already running: the session holds its
 * own copy of the prices, taken when it started.
 */
export function saveRestaurant(
  restaurants: SushiRestaurant[],
  restaurant: SushiRestaurant,
): SushiRestaurant[] {
  const next = restaurants.some((r) => r.id === restaurant.id)
    ? restaurants.map((r) => (r.id === restaurant.id ? restaurant : r))
    : [...restaurants, restaurant]

  write(RESTAURANTS_KEY, next)
  return next
}

export function forgetRestaurant(
  restaurants: SushiRestaurant[],
  id: string,
): SushiRestaurant[] {
  const next = restaurants.filter((r) => r.id !== id)
  write(RESTAURANTS_KEY, next)
  return next
}

function isPlateType(value: unknown): value is PlateType {
  return (
    isObject(value) &&
    typeof value.id === 'string' &&
    typeof value.label === 'string' &&
    typeof value.price === 'string' &&
    isColor(value.color)
  )
}

function isDiner(value: unknown): value is Diner {
  return (
    isObject(value) &&
    typeof value.id === 'string' &&
    typeof value.name === 'string' &&
    isObject(value.counts) &&
    Object.values(value.counts).every((n) => typeof n === 'number')
  )
}

function isSession(value: unknown): value is SushiSession {
  return (
    isObject(value) &&
    typeof value.restaurantId === 'string' &&
    typeof value.restaurantName === 'string' &&
    Array.isArray(value.plates) &&
    value.plates.every(isPlateType) &&
    Array.isArray(value.diners) &&
    value.diners.every(isDiner) &&
    typeof value.serviceChargeEnabled === 'boolean' &&
    typeof value.serviceChargePct === 'string' &&
    typeof value.vatEnabled === 'boolean' &&
    typeof value.vatPct === 'string' &&
    (value.discountKind === 'percent' || value.discountKind === 'amount') &&
    typeof value.discountValue === 'string' &&
    typeof value.payerId === 'string'
  )
}

/**
 * The session from before a refresh, if there was one.
 *
 * Plates get counted over a whole meal, and a phone closing the tab halfway
 * should not cost everyone their tapping. The session already carries its own
 * price snapshot, so it comes back exactly as it was — even if the restaurant it
 * came from has since been edited or forgotten.
 */
export function loadSession(): SushiSession | null {
  return read(SESSION_KEY, isSession)
}

export function saveSession(session: SushiSession): void {
  write(SESSION_KEY, session)
}

export function clearSession(): void {
  try {
    localStorage.removeItem(SESSION_KEY)
  } catch {
    // Nothing to clear if storage is unavailable.
  }
}
