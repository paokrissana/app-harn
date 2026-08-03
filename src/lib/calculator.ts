/** A single dish the user ordered for themselves. */
export interface Plate {
  name: string
  price: number
}

/** A dish shared between several people. */
export interface SharedPlate {
  name: string
  price: number
  /** Number of people splitting this dish, including the user. */
  shares: number
}

/** A tip is either a percentage of the charged total, or a flat sum in Baht. */
export type TipMode = 'percent' | 'amount'

/** Validated inputs from the payback form. */
export interface PaybackInput {
  /** Whole group's bill total — reference only, not used in the math. */
  totalBill: number
  /** Plates the user ordered just for themselves. */
  items: Plate[]
  /** Plates shared with others; the user pays price / shares of each. */
  sharedItems: SharedPlate[]
  /** Whether service charge applies at all. Defaults to true. */
  serviceChargeEnabled?: boolean
  /** Service charge, as a percentage (e.g. 10 for 10%). */
  serviceChargePct: number
  /** Whether VAT applies at all. Defaults to true. */
  vatEnabled?: boolean
  /** VAT, as a percentage (e.g. 7 for 7%). */
  vatPct: number
  /** Whether a tip is added. Defaults to false — most bills have none. */
  tipEnabled?: boolean
  /** Whether `tipValue` is a percentage or a flat number of Baht. */
  tipMode?: TipMode
  /** A percentage of the charged total, or an amount in Baht. */
  tipValue?: number
}

/** What the user owes the person who paid. */
export interface PaybackResult {
  /** Passed through for reference/display. */
  totalBill: number
  /** Sum of the user's own plates. */
  yourOwnFood: number
  /** The user's slice of the shared plates. */
  yourSharedFood: number
  /** Own plates + shared slice, before charges. */
  yourFood: number
  /** Whether service charge was applied — false when switched off. */
  serviceChargeApplied: boolean
  serviceCharge: number
  subtotal: number
  /** Whether VAT was applied — false when switched off. */
  vatApplied: boolean
  vat: number
  /** Everything the bill itself asks for: food, service charge and VAT. */
  charged: number
  /** Whether a tip was added — false when switched off. */
  tipApplied: boolean
  tip: number
  /** Final amount to pay back, tip included. */
  youPay: number
}

/** Sum the prices of a list of plates. */
export function sumPlates(items: Plate[]): number {
  return items.reduce((total, item) => total + item.price, 0)
}

/** The user's slice of one shared plate: price split evenly across sharers. */
export function shareOfPlate(plate: SharedPlate): number {
  return plate.shares > 0 ? plate.price / plate.shares : 0
}

/** Sum the user's slices across all shared plates. */
export function sumSharedPlates(items: SharedPlate[]): number {
  return items.reduce((total, item) => total + shareOfPlate(item), 0)
}

/**
 * Work out what the user owes the person who paid the group bill: their own
 * plates plus their slice of any shared plates, with service charge and VAT
 * added on top. Either charge can be switched off; both apply by default.
 *
 * A tip is extra, on top of everything the bill asked for — a percentage tip
 * is taken from the charged total, so it grows with service charge and VAT.
 */
export function calculatePayback(input: PaybackInput): PaybackResult {
  const { totalBill, items, sharedItems, serviceChargePct, vatPct } = input
  const serviceChargeApplied = input.serviceChargeEnabled ?? true
  const vatApplied = input.vatEnabled ?? true
  const tipApplied = input.tipEnabled ?? false

  const yourOwnFood = sumPlates(items)
  const yourSharedFood = sumSharedPlates(sharedItems)
  const yourFood = yourOwnFood + yourSharedFood
  const serviceCharge = serviceChargeApplied
    ? yourFood * (serviceChargePct / 100)
    : 0
  const subtotal = yourFood + serviceCharge
  const vat = vatApplied ? subtotal * (vatPct / 100) : 0
  const charged = subtotal + vat

  const tipValue = input.tipValue ?? 0
  const tip = tipApplied
    ? input.tipMode === 'amount'
      ? tipValue
      : charged * (tipValue / 100)
    : 0

  return {
    totalBill,
    yourOwnFood,
    yourSharedFood,
    yourFood,
    serviceChargeApplied,
    serviceCharge,
    subtotal,
    vatApplied,
    vat,
    charged,
    tipApplied,
    tip,
    youPay: charged + tip,
  }
}

/** Format a number as Thai Baht, e.g. `1234.5` -> `"1,234.50 THB"`. */
export function formatTHB(amount: number): string {
  const formatted = new Intl.NumberFormat('en-US', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(amount)
  return `${formatted} THB`
}
