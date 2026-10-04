/**
 * A sushi split session: where you are eating, what each plate costs there, who
 * is at the table, and how many of each plate they had.
 *
 * Framework independent — pure functions over plain data, so the component only
 * renders and dispatches.
 *
 * **Prices belong to a restaurant, never to a colour.** A red plate is ฿40 at
 * one place and ฿50 at the next, so there is no table of colour prices anywhere
 * in Harn. A restaurant carries its own list, and a session copies that list
 * when it starts.
 *
 * **The copy is the snapshot.** Once a session has its plates, nothing reads the
 * restaurant again. If a saved restaurant's prices change tomorrow, a session
 * started today still adds up the way it did — a calculation never shifts
 * silently underneath the people who already paid by it.
 */

import { newId } from '@/shared/lib/id'

/**
 * A plate colour, for the swatch. Purely visual: the label and the price are what
 * count, and the label always shows, so nothing depends on telling two colours
 * apart.
 */
export type PlateColor =
  | 'red'
  | 'orange'
  | 'yellow'
  | 'green'
  | 'blue'
  | 'purple'
  | 'pink'
  | 'brown'
  | 'black'
  | 'white'
  | 'silver'
  | 'gold'

export const PLATE_COLORS: PlateColor[] = [
  'red',
  'orange',
  'yellow',
  'green',
  'blue',
  'purple',
  'pink',
  'brown',
  'black',
  'white',
  'silver',
  'gold',
]

/** A plate type as a restaurant defines it. */
export interface PlatePrice {
  id: string
  label: string
  price: number
  color: PlateColor | null
}

/** A restaurant and its own plate prices. */
export interface SushiRestaurant {
  id: string
  name: string
  pricing: PlatePrice[]
}

/** A plate type inside a session — the price kept as typed, so it can be edited. */
export interface PlateType {
  id: string
  label: string
  price: string
  color: PlateColor | null
}

/** Somebody at the table. */
export interface Diner {
  id: string
  name: string
  /** Plates eaten, by plate type id. A missing id means none. */
  counts: Record<string, number>
}

export interface SushiSession {
  /** Where the prices came from: a saved restaurant's id, or `OTHER`. */
  restaurantId: string
  restaurantName: string
  /** The price snapshot, copied when the session started. */
  plates: PlateType[]
  diners: Diner[]
  serviceChargeEnabled: boolean
  serviceChargePct: string
  vatEnabled: boolean
  vatPct: string
  discountKind: 'percent' | 'amount'
  discountValue: string
  payerId: string
}

/** The restaurant that is not in the list yet. */
export const OTHER = 'other'

export function newDiner(): Diner {
  return { id: newId(), name: '', counts: {} }
}

export function newPlateType(): PlateType {
  return { id: newId(), label: '', price: '', color: null }
}

/**
 * The plates a new restaurant starts with: the four colours almost every
 * conveyor belt uses, with **no prices**.
 *
 * Labels and colours save typing; prices would be a guess, and a guessed price
 * under a real meal is worse than an empty box that has to be filled. The ids
 * are stable on purpose — two restaurants both built from this keep "red" as
 * the same plate type, so switching between them keeps the counts.
 */
export function templatePlates(nameOf: ColorNamer = englishName): PlateType[] {
  return (['red', 'blue', 'green', 'yellow'] as const).map((color) => ({
    id: color,
    label: nameOf(color),
    price: '',
    color,
  }))
}

/**
 * What to call a colour when it becomes a plate label. Passed in rather than
 * looked up, so this module stays free of the translation layer — the caller
 * hands over Thai names when the page is in Thai.
 */
export type ColorNamer = (color: PlateColor) => string

const englishName: ColorNamer = (color) =>
  color.charAt(0).toUpperCase() + color.slice(1)

/**
 * Copy a restaurant's prices into a session.
 *
 * Every plate becomes a new object, so the session shares nothing with the
 * restaurant it came from — which is the whole snapshot guarantee, and why this
 * is a map rather than a reference.
 */
function snapshotOf(
  restaurant: SushiRestaurant | null,
  nameOf?: ColorNamer,
): PlateType[] {
  if (!restaurant) return templatePlates(nameOf)

  return restaurant.pricing.map((plate) => ({
    id: plate.id,
    label: plate.label,
    price: String(plate.price),
    color: plate.color,
  }))
}

/** A fresh session at a restaurant, or at a new one when given none. */
export function startSession(
  restaurant: SushiRestaurant | null,
  nameOf?: ColorNamer,
): SushiSession {
  const [first, second] = [newDiner(), newDiner()]

  return {
    restaurantId: restaurant?.id ?? OTHER,
    restaurantName: restaurant?.name ?? '',
    plates: snapshotOf(restaurant, nameOf),
    diners: [first, second],
    serviceChargeEnabled: true,
    serviceChargePct: '10',
    vatEnabled: true,
    vatPct: '7',
    discountKind: 'amount',
    discountValue: '0',
    payerId: first.id,
  }
}

/** Only the counts for plate types the session still has. */
function keepCounts(
  counts: Record<string, number>,
  plates: PlateType[],
): Record<string, number> {
  const ids = new Set(plates.map((plate) => plate.id))
  return Object.fromEntries(
    Object.entries(counts).filter(([id]) => ids.has(id)),
  )
}

/**
 * Move a session to another restaurant, keeping the people and as many counts
 * as still make sense.
 *
 * The new restaurant's prices replace the old ones entirely — the same colour at
 * a different place is a different price, and none of the old one carries over.
 * Counts are kept for any plate type with the same id: picking the wrong
 * restaurant and fixing it should not mean counting everyone's plates again.
 */
export function switchRestaurant(
  session: SushiSession,
  restaurant: SushiRestaurant | null,
  nameOf?: ColorNamer,
): SushiSession {
  const plates = snapshotOf(restaurant, nameOf)

  return {
    ...session,
    restaurantId: restaurant?.id ?? OTHER,
    restaurantName: restaurant?.name ?? '',
    plates,
    diners: session.diners.map((diner) => ({
      ...diner,
      counts: keepCounts(diner.counts, plates),
    })),
  }
}

/** Add or take away plates, never going below none. */
export function changeCount(
  session: SushiSession,
  dinerId: string,
  plateId: string,
  delta: number,
): SushiSession {
  return {
    ...session,
    diners: session.diners.map((diner) => {
      if (diner.id !== dinerId) return diner
      const next = Math.max((diner.counts[plateId] ?? 0) + delta, 0)
      return { ...diner, counts: { ...diner.counts, [plateId]: next } }
    }),
  }
}

/** Change one field of one plate type. */
export function updatePlate(
  session: SushiSession,
  plateId: string,
  change: Partial<Omit<PlateType, 'id'>>,
): SushiSession {
  return {
    ...session,
    plates: session.plates.map((plate) =>
      plate.id === plateId ? { ...plate, ...change } : plate,
    ),
  }
}

export function addPlate(session: SushiSession): SushiSession {
  return { ...session, plates: [...session.plates, newPlateType()] }
}

/** Drop a plate type, and every count of it — nobody can owe for a plate that is gone. */
export function removePlate(
  session: SushiSession,
  plateId: string,
): SushiSession {
  const plates = session.plates.filter((plate) => plate.id !== plateId)

  return {
    ...session,
    plates,
    diners: session.diners.map((diner) => ({
      ...diner,
      counts: keepCounts(diner.counts, plates),
    })),
  }
}

export function addDiner(session: SushiSession): SushiSession {
  return { ...session, diners: [...session.diners, newDiner()] }
}

/**
 * Remove somebody, and pass the bill to whoever is left if they were paying. A
 * dangling payer would fail validation against a person no longer on screen.
 */
export function removeDiner(
  session: SushiSession,
  dinerId: string,
): SushiSession {
  const diners = session.diners.filter((diner) => diner.id !== dinerId)

  return {
    ...session,
    diners,
    payerId:
      session.payerId === dinerId ? (diners[0]?.id ?? '') : session.payerId,
  }
}

/** A typed price as a number, or nothing while the box is blank or wrong. */
export function priceOf(plate: PlateType): number | null {
  if (plate.price.trim() === '') return null
  const value = Number(plate.price)
  return Number.isFinite(value) && value >= 0 ? value : null
}

/** One line of somebody's plates: how many, and what they come to. */
export interface PlateLine {
  plate: PlateType
  quantity: number
  /** Quantity × price, or 0 while the price is not filled in yet. */
  subtotal: number
}

/** What somebody had, in the order the plates are listed, leaving out the ones they skipped. */
export function linesFor(diner: Diner, plates: PlateType[]): PlateLine[] {
  return plates
    .map((plate) => {
      const quantity = diner.counts[plate.id] ?? 0
      return { plate, quantity, subtotal: quantity * (priceOf(plate) ?? 0) }
    })
    .filter((line) => line.quantity > 0)
}

/**
 * Somebody's food so far, for the live total on their card. A plate with no
 * price yet counts as nothing rather than blocking the total — the form says
 * which price is missing when it is submitted.
 */
export function foodSoFar(diner: Diner, plates: PlateType[]): number {
  return linesFor(diner, plates).reduce((sum, line) => sum + line.subtotal, 0)
}

/** How many plates somebody has, of any kind. */
export function plateCount(diner: Diner): number {
  return Object.values(diner.counts).reduce((sum, n) => sum + n, 0)
}

/** Turn a session's plates back into a restaurant, for saving it. */
export function toRestaurant(
  session: SushiSession,
  id: string,
): SushiRestaurant {
  return {
    id,
    name: session.restaurantName.trim(),
    pricing: session.plates.map((plate) => ({
      id: plate.id,
      label: plate.label.trim(),
      price: priceOf(plate) ?? 0,
      color: plate.color,
    })),
  }
}
