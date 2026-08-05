/** Two decimals and thousands separators, e.g. `1234.5` -> `"1,234.50"`. */
export function formatBaht(amount: number, withSuffix = true): string {
  const formatted = new Intl.NumberFormat('en-US', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(amount)

  return withSuffix ? `${formatted} THB` : formatted
}
