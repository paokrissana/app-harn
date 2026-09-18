/**
 * The percentage calculator's maths: four everyday questions, four functions.
 *
 * Framework independent — no React, no formatting, no validation. Callers hand
 * in numbers they have already checked and get numbers back.
 */

/** Which question is being asked. */
export type PercentageMode = 'of' | 'discount' | 'increase' | 'relation'

export const PERCENTAGE_MODES: PercentageMode[] = [
  'of',
  'discount',
  'increase',
  'relation',
]

/** What is `percentage`% of `amount`? */
export function calculatePercentageOf(
  percentage: number,
  amount: number,
): number {
  return (amount * percentage) / 100
}

/** Both halves of a reduction — what comes off, and what is left to pay. */
export interface DiscountResult {
  /** What the promo takes off. */
  discount: number
  /** What you actually hand over. */
  final: number
}

/** Reduce `amount` by `percentage`%. */
export function calculateDiscount(
  amount: number,
  percentage: number,
): DiscountResult {
  const discount = (amount * percentage) / 100
  return { discount, final: amount - discount }
}

/** Both halves of a rise — what is added, and what it comes to. */
export interface IncreaseResult {
  /** What gets added on. */
  increase: number
  /** The new figure. */
  final: number
}

/** Increase `amount` by `percentage`%. */
export function calculateIncrease(
  amount: number,
  percentage: number,
): IncreaseResult {
  const increase = (amount * percentage) / 100
  return { increase, final: amount + increase }
}

/**
 * `part` is what percentage of `whole`?
 *
 * A whole of nothing has no answer — every number is an infinite percentage of
 * zero — so the caller must rule it out first. Guarded here as well rather than
 * returning Infinity into the UI.
 */
export function calculatePercentageRelation(
  part: number,
  whole: number,
): number {
  if (whole === 0) return 0
  return (part / whole) * 100
}

/**
 * VAT added on top of a price that does not include it.
 *
 * The same arithmetic as `calculateIncrease`, named for the question people
 * actually ask — and paired with `removeVat` below, which is not.
 */
export function addVat(net: number, vatPct: number): { vat: number; total: number } {
  const vat = (net * vatPct) / 100
  return { vat, total: net + vat }
}

/**
 * The price before VAT, taken out of a price that already includes it.
 *
 * **Not** the same as taking the percentage off. ฿107 including 7% VAT is ฿100
 * before it, not ฿99.51 — the VAT was charged on the smaller number, so coming
 * back means dividing by 1.07 rather than subtracting 7%. Getting this backwards
 * is the single most common VAT mistake, and it is the reason this calculator is
 * worth having at all.
 */
export function removeVat(
  gross: number,
  vatPct: number,
): { net: number; vat: number } {
  const net = gross / (1 + vatPct / 100)
  return { net, vat: gross - net }
}

/** Each step of a Thai restaurant bill, and what it comes to. */
export interface RestaurantCharges {
  serviceCharge: number
  vat: number
  total: number
}

/**
 * Food plus service charge plus VAT, in the order a receipt applies them.
 *
 * Service charge goes on the food, then VAT goes on **both**. That order is why
 * the two cannot collapse into a single 17% — on ฿1,000 the real total is
 * ฿1,177, not ฿1,170.
 */
export function restaurantCharges(
  subtotal: number,
  servicePct: number,
  vatPct: number,
): RestaurantCharges {
  const serviceCharge = (subtotal * servicePct) / 100
  const vat = ((subtotal + serviceCharge) * vatPct) / 100

  return { serviceCharge, vat, total: subtotal + serviceCharge + vat }
}

/** A tip, what the bill comes to with it, and each person's share. */
export interface TipResult {
  tip: number
  total: number
  /** What each person hands over, or the whole total when splitting by one. */
  each: number
}

/**
 * A tip on a bill, optionally split.
 *
 * `people` below one is treated as one: a bill split zero ways has no answer,
 * and returning the whole total is more useful than returning Infinity.
 */
export function calculateTip(
  bill: number,
  tipPct: number,
  people = 1,
): TipResult {
  const tip = (bill * tipPct) / 100
  const total = bill + tip
  const heads = Math.max(Math.floor(people), 1)

  return { tip, total, each: total / heads }
}
