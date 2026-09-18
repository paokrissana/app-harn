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
