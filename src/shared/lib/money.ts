/** Two decimals and thousands separators, e.g. `1234.5` -> `"1,234.50"`. */
export function formatBaht(amount: number, withSuffix = true): string {
  const formatted = new Intl.NumberFormat('en-US', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(amount)

  return withSuffix ? `${formatted} THB` : formatted
}

/**
 * A plain number for display: thousands separators, and decimals only when
 * there are any — `1200` -> `"1,200"`, `1200.5` -> `"1,200.50"`.
 *
 * Unlike `formatBaht` this does not force two decimals, because a percentage
 * answer of `80` should read as `80`, not `80.00`. Anything finer than two
 * decimals is rounded, which is as much precision as these calculators claim.
 */
export function formatAmount(value: number): string {
  const rounded = Math.round(value * 100) / 100

  return new Intl.NumberFormat('en-US', {
    minimumFractionDigits: Number.isInteger(rounded) ? 0 : 2,
    maximumFractionDigits: 2,
  }).format(rounded)
}
