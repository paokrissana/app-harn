import { useI18n } from '@/i18n/context'
import { cn } from '@/lib/utils'

/** Whether a number means a percentage of something, or a sum of Baht. */
export type ValueKind = 'percent' | 'amount'

/**
 * A two-way switch between the two. Used by the tip row and by every discount
 * and promo row, so they all read and behave the same way.
 */
export function ValueKindToggle({
  kind,
  onChange,
  disabled = false,
  label,
}: {
  kind: ValueKind
  onChange: (kind: ValueKind) => void
  disabled?: boolean
  /** Names the pair for screen readers, e.g. "Tip as a percentage or amount". */
  label: string
}) {
  const { t } = useI18n()

  const option = (value: ValueKind, symbol: string, name: string) => (
    <button
      type="button"
      aria-label={name}
      aria-pressed={kind === value}
      disabled={disabled}
      onClick={() => onChange(value)}
      className={cn(
        'h-7 w-8 text-sm font-medium transition-colors disabled:opacity-50',
        kind === value
          ? 'bg-primary text-primary-foreground'
          : 'text-muted-foreground hover:bg-accent',
      )}
    >
      {symbol}
    </button>
  )

  return (
    <div
      role="group"
      aria-label={label}
      className={cn(
        'border-input flex shrink-0 overflow-hidden rounded-md border',
        disabled && 'opacity-50',
      )}
    >
      {option('percent', '%', t('tipAsPercent'))}
      {option('amount', '฿', t('tipAsAmount'))}
    </div>
  )
}
