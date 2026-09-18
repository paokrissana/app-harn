import { useState, type ComponentProps, type ReactNode } from 'react'
import { CheckIcon, CopyIcon } from 'lucide-react'

import { useI18n } from '@/i18n/context'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'

/**
 * The pieces the three small calculators share.
 *
 * They all have the same shape — a couple of boxes and one answer that costs
 * nothing to work out — so they all answer live, with no Calculate button, for
 * the reason recorded in CLAUDE.md §4.
 */

/** A box holding a number, with its unit shown inside. */
export function NumberField({
  id,
  label,
  unit,
  value,
  onChange,
  ...props
}: {
  id: string
  label: string
  /** `฿` sits before the number, `%` after it. */
  unit: '฿' | '%' | null
  value: string
  onChange: (value: string) => void
} & Omit<ComponentProps<typeof Input>, 'value' | 'onChange' | 'id'>) {
  return (
    <div className="flex flex-col gap-1">
      <Label htmlFor={id}>{label}</Label>
      <div className="relative">
        {unit === '฿' && (
          <span className="text-muted-foreground pointer-events-none absolute top-1/2 left-3 -translate-y-1/2 text-sm">
            ฿
          </span>
        )}
        <Input
          id={id}
          type="number"
          step="any"
          inputMode="decimal"
          placeholder="0"
          autoComplete="off"
          className={cn(unit === '฿' && 'pl-7', unit === '%' && 'pr-8')}
          value={value}
          onChange={(event) => onChange(event.target.value)}
          {...props}
        />
        {unit === '%' && (
          <span className="text-muted-foreground pointer-events-none absolute top-1/2 right-3 -translate-y-1/2 text-sm">
            %
          </span>
        )}
      </div>
    </div>
  )
}

/** A two-way switch, for the calculators that ask a question both ways. */
export function ModeTabs<T extends string>({
  label,
  modes,
  current,
  onChange,
  labelFor,
}: {
  label: string
  modes: readonly T[]
  current: T
  onChange: (mode: T) => void
  labelFor: (mode: T) => string
}) {
  return (
    <div
      role="tablist"
      aria-label={label}
      className="bg-muted flex gap-1 rounded-lg p-1"
    >
      {modes.map((mode) => (
        <button
          key={mode}
          type="button"
          role="tab"
          aria-selected={mode === current}
          onClick={() => onChange(mode)}
          className={cn(
            'focus-visible:ring-ring/50 flex-1 rounded-md px-2 py-2 text-sm font-medium transition-colors outline-none focus-visible:ring-[3px]',
            mode === current
              ? 'bg-background text-foreground shadow-sm'
              : 'text-muted-foreground hover:text-foreground',
          )}
        >
          {labelFor(mode)}
        </button>
      ))}
    </div>
  )
}

/** One line of working above the headline figure. */
export function WorkingRow({
  label,
  value,
}: {
  label: string
  value: string
}) {
  return (
    <p className="flex items-baseline justify-between gap-3 text-sm">
      <span className="text-muted-foreground">{label}</span>
      <span className="tabular-nums">{value}</span>
    </p>
  )
}

/**
 * The answer: any working, then the figure that was actually asked for, then a
 * way to copy it.
 */
export function ResultCard({
  headline,
  result,
  copyText,
  children,
}: {
  headline: string
  result: string
  copyText: string
  /** Working rows, shown above the headline. */
  children?: ReactNode
}) {
  const { t } = useI18n()
  const [copied, setCopied] = useState(false)

  const handleCopy = async () => {
    await navigator.clipboard.writeText(copyText)
    setCopied(true)
    window.setTimeout(() => setCopied(false), 2000)
  }

  return (
    <Card>
      <CardContent
        aria-live="polite"
        className="flex flex-col gap-2 pt-6 text-center"
      >
        {children && <div className="flex flex-col gap-1 text-left">{children}</div>}

        <p className="text-muted-foreground text-xs tracking-wide uppercase">
          {headline}
        </p>
        <p className="text-4xl font-extrabold tracking-tight tabular-nums">
          {result}
        </p>

        <Button
          type="button"
          variant="outline"
          size="sm"
          className="mt-2 self-center"
          onClick={handleCopy}
        >
          {copied ? <CheckIcon /> : <CopyIcon />}
          {copied ? t('copied') : t('copyResult')}
        </Button>
      </CardContent>
    </Card>
  )
}

/** Read a typed box; blank means "not filled in yet", never zero. */
export function parseNumber(raw: string): number | null {
  const trimmed = raw.trim()
  if (trimmed === '') return null

  const value = Number(trimmed)
  return Number.isFinite(value) ? value : null
}
