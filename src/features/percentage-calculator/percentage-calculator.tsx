import { useState } from 'react'
import { CheckIcon, CopyIcon } from 'lucide-react'

import { formatAmount } from '@/shared/lib/money'
import { useI18n } from '@/i18n/context'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  calculateDiscount,
  calculateIncrease,
  calculatePercentageOf,
  calculatePercentageRelation,
  PERCENTAGE_MODES,
  type PercentageMode,
} from '@/shared/lib/percentage'
import {
  isAnswerable,
  MODE_FIELDS,
  MODE_LABEL,
  MODE_QUESTION,
  MODE_TAB,
  parseNumber,
  validate,
  type PercentageErrors,
  type Translate,
} from './schema'

function FieldError({ message }: { message?: string }) {
  if (!message) return null
  return <p className="text-destructive text-sm">{message}</p>
}

/** One answer: the question restated, the headline figure, and any working. */
interface Answer {
  /** The question in words, e.g. `80% of 1,500`. */
  question: string
  /** The label above the big number. */
  resultLabel: string
  /** The big number, already formatted. */
  result: string
  /** An extra line, e.g. the discount that produced the final amount. */
  detail?: string
}

export function PercentageCalculator() {
  const { t } = useI18n()
  const [mode, setMode] = useState<PercentageMode>('of')
  const [percentageRaw, setPercentageRaw] = useState('')
  const [amountRaw, setAmountRaw] = useState('')
  const [copied, setCopied] = useState(false)

  const errors: PercentageErrors = validate(mode, percentageRaw, amountRaw, t)
  const ready = isAnswerable(percentageRaw, amountRaw, errors)

  const percentage = parseNumber(percentageRaw) ?? 0
  const amount = parseNumber(amountRaw) ?? 0
  const fields = MODE_FIELDS[mode]

  const answer = ready ? answerFor(mode, percentage, amount, t) : null

  const handleCopy = async () => {
    if (!answer) return
    await navigator.clipboard.writeText(
      `${answer.question} = ${answer.result}`.replace(/\s+/g, ' '),
    )
    setCopied(true)
    window.setTimeout(() => setCopied(false), 2000)
  }

  /** Switching question keeps the numbers — usually you want the same ones. */
  const switchMode = (next: PercentageMode) => {
    setMode(next)
    setCopied(false)
  }

  return (
    <div className="flex flex-col gap-5">
      <div
        role="tablist"
        aria-label={t('pcModes')}
        className="bg-muted flex gap-1 rounded-lg p-1"
      >
        {PERCENTAGE_MODES.map((option) => (
          <button
            key={option}
            type="button"
            role="tab"
            aria-selected={option === mode}
            aria-label={t(MODE_LABEL[option])}
            onClick={() => switchMode(option)}
            className={cn(
              'focus-visible:ring-ring/50 flex-1 rounded-md px-2 py-2 text-sm font-medium transition-colors outline-none focus-visible:ring-[3px]',
              option === mode
                ? 'bg-background text-foreground shadow-sm'
                : 'text-muted-foreground hover:text-foreground',
            )}
          >
            {t(MODE_TAB[option])}
          </button>
        ))}
      </div>

      <Card>
        <CardContent className="flex flex-col gap-4 pt-6">
          <p className="text-muted-foreground text-sm">
            {t(MODE_QUESTION[mode])}
          </p>

          <div className="flex flex-col gap-1">
            <Label htmlFor="pcPercentage">{t(fields.percentageLabel)}</Label>
            <Input
              id="pcPercentage"
              type="number"
              step="any"
              inputMode="decimal"
              placeholder="0"
              autoComplete="off"
              aria-invalid={!!errors.percentage}
              value={percentageRaw}
              onChange={(event) => setPercentageRaw(event.target.value)}
            />
            <FieldError message={errors.percentage} />
          </div>

          <div className="flex flex-col gap-1">
            <Label htmlFor="pcAmount">{t(fields.amountLabel)}</Label>
            <Input
              id="pcAmount"
              type="number"
              step="any"
              inputMode="decimal"
              placeholder="0"
              autoComplete="off"
              aria-invalid={!!errors.amount}
              value={amountRaw}
              onChange={(event) => setAmountRaw(event.target.value)}
            />
            <FieldError message={errors.amount} />
          </div>
        </CardContent>
      </Card>

      {/*
        No Calculate button: two boxes and an answer that costs nothing to
        work out, so waiting for a tap would only get in the way.
      */}
      {answer && (
        <Card>
          <CardContent
            aria-live="polite"
            className="flex flex-col gap-2 pt-6 text-center"
          >
            <p className="text-muted-foreground text-sm">{answer.question}</p>

            {answer.detail && (
              <p className="text-muted-foreground text-sm">{answer.detail}</p>
            )}

            <p className="text-muted-foreground text-xs tracking-wide uppercase">
              {answer.resultLabel}
            </p>
            <p className="text-4xl font-extrabold tracking-tight tabular-nums">
              {answer.result}
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
      )}
    </div>
  )
}

/** Turn a mode and two numbers into something worth reading. */
function answerFor(
  mode: PercentageMode,
  percentage: number,
  amount: number,
  translate: Translate,
): Answer {
  const pct = formatAmount(percentage)
  const amt = formatAmount(amount)

  switch (mode) {
    case 'of':
      return {
        question: translate('pcAnswerOf', { percentage: pct, amount: amt }),
        resultLabel: translate('pcResult'),
        result: formatAmount(calculatePercentageOf(percentage, amount)),
      }

    case 'discount': {
      const { discount, final } = calculateDiscount(amount, percentage)
      return {
        question: translate('pcAnswerDiscount', {
          percentage: pct,
          amount: amt,
        }),
        detail: translate('pcAnswerDiscountOff', {
          amount: formatAmount(discount),
        }),
        resultLabel: translate('pcYouPay'),
        result: formatAmount(final),
      }
    }

    case 'increase': {
      const { increase, final } = calculateIncrease(amount, percentage)
      return {
        question: translate('pcAnswerIncrease', {
          percentage: pct,
          amount: amt,
        }),
        detail: translate('pcAnswerIncreaseAdded', {
          amount: formatAmount(increase),
        }),
        resultLabel: translate('pcNewAmount'),
        result: formatAmount(final),
      }
    }

    case 'relation':
      return {
        question: translate('pcAnswerRelation', { part: pct, whole: amt }),
        resultLabel: translate('pcResult'),
        result: `${formatAmount(calculatePercentageRelation(percentage, amount))}%`,
      }
  }
}
