export type Payer = 'A' | 'B'

/** Raw, validated numeric inputs for a bill split. */
export interface SplitInput {
  /** Who physically paid the restaurant. */
  payer: Payer
  /** Person A's food amount (before service charge and VAT). */
  foodA: number
  /** Person B's food amount (before service charge and VAT). */
  foodB: number
  /** Service charge, as a percentage (e.g. 10 for 10%). */
  serviceChargePct: number
  /** VAT, as a percentage (e.g. 7 for 7%). */
  vatPct: number
}

/** Full breakdown of a bill split. */
export interface SplitResult {
  foodTotal: number
  serviceCharge: number
  subtotal: number
  vat: number
  grandTotal: number
  ratioA: number
  ratioB: number
  paymentA: number
  paymentB: number
  payer: Payer
  /** The person who owes money to the payer. */
  debtor: Payer
  /** The amount the debtor should transfer to the payer. */
  transferAmount: number
}

/**
 * Split a restaurant bill between two people, proportional to what each ate,
 * including service charge and VAT.
 *
 * `foodTotal` must be greater than zero — callers are expected to validate this
 * upstream (see the form schema). With a zero food total the per-person ratios
 * are undefined and the result will contain `NaN`.
 */
export function calculateSplit(input: SplitInput): SplitResult {
  const { payer, foodA, foodB, serviceChargePct, vatPct } = input

  const foodTotal = foodA + foodB
  const serviceCharge = foodTotal * (serviceChargePct / 100)
  const subtotal = foodTotal + serviceCharge
  const vat = subtotal * (vatPct / 100)
  const grandTotal = subtotal + vat

  const ratioA = foodA / foodTotal
  const ratioB = foodB / foodTotal
  const paymentA = grandTotal * ratioA
  const paymentB = grandTotal * ratioB

  // The person who did NOT pay owes their share to the payer.
  const debtor: Payer = payer === 'A' ? 'B' : 'A'
  const transferAmount = payer === 'A' ? paymentB : paymentA

  return {
    foodTotal,
    serviceCharge,
    subtotal,
    vat,
    grandTotal,
    ratioA,
    ratioB,
    paymentA,
    paymentB,
    payer,
    debtor,
    transferAmount,
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

/**
 * Human-readable settlement sentence, e.g.
 * `"B should transfer 493.42 THB to A"`.
 */
export function settlementSentence(result: SplitResult): string {
  return `${result.debtor} should transfer ${formatTHB(
    result.transferAmount,
  )} to ${result.payer}`
}
