import type { TranslationKey } from '@/i18n/translations'
import type { PercentageMode } from './percentage'

export type Translate = (
  key: TranslationKey,
  params?: Record<string, string | number>,
) => string

/** One box's worth of trouble, or nothing if it is fine. */
export type FieldError = string | undefined

export interface PercentageErrors {
  percentage?: string
  amount?: string
}

/**
 * What each mode calls its two boxes. The maths is always "a percentage and an
 * amount", but the words change with the question, and so do the bounds.
 */
export interface ModeFields {
  percentageLabel: TranslationKey
  amountLabel: TranslationKey
}

/** The short label on each tab. Words, not glyphs — four symbols in a row said
 * nothing about what any of them did. */
export const MODE_TAB: Record<PercentageMode, TranslationKey> = {
  of: 'pcTabOf',
  discount: 'pcTabDiscount',
  increase: 'pcTabIncrease',
  relation: 'pcTabRelation',
}

/** The spoken name of each question, for screen readers and the page copy. */
export const MODE_LABEL: Record<PercentageMode, TranslationKey> = {
  of: 'pcModeOf',
  discount: 'pcModeDiscount',
  increase: 'pcModeIncrease',
  relation: 'pcModeRelation',
}

/** The question each mode answers, shown above its two boxes. */
export const MODE_QUESTION: Record<PercentageMode, TranslationKey> = {
  of: 'pcQuestionOf',
  discount: 'pcQuestionDiscount',
  increase: 'pcQuestionIncrease',
  relation: 'pcQuestionRelation',
}

export const MODE_FIELDS: Record<PercentageMode, ModeFields> = {
  of: { percentageLabel: 'pcPercentage', amountLabel: 'pcAmount' },
  discount: { percentageLabel: 'pcDiscountPct', amountLabel: 'pcOriginal' },
  increase: { percentageLabel: 'pcIncreasePct', amountLabel: 'pcOriginal' },
  relation: { percentageLabel: 'pcPart', amountLabel: 'pcWhole' },
}

/**
 * Read a typed box.
 *
 * Empty is its own state — "not filled in yet", not zero. The calculator shows
 * nothing until both boxes hold a number, rather than answering a question
 * nobody finished asking.
 */
export function parseNumber(raw: string): number | null {
  const trimmed = raw.trim()
  if (trimmed === '') return null

  const value = Number(trimmed)
  return Number.isFinite(value) ? value : null
}

/**
 * Check one mode's two boxes.
 *
 * Bounds are per mode, not global: a discount over 100% would leave you with
 * less than nothing, while "300% of 50" is a perfectly ordinary question. A
 * whole of zero has no answer at all.
 */
export function validate(
  mode: PercentageMode,
  percentageRaw: string,
  amountRaw: string,
  t: Translate,
): PercentageErrors {
  const errors: PercentageErrors = {}

  const check = (raw: string): FieldError => {
    if (raw.trim() === '') return undefined // not filled in yet, not wrong
    if (parseNumber(raw) === null) return t('numbersOnly')
    return undefined
  }

  errors.percentage = check(percentageRaw)
  errors.amount = check(amountRaw)

  const percentage = parseNumber(percentageRaw)
  const amount = parseNumber(amountRaw)

  if (!errors.percentage && percentage !== null && percentage < 0) {
    errors.percentage = t('cannotBeNegative')
  }
  if (!errors.amount && amount !== null && amount < 0) {
    errors.amount = t('cannotBeNegative')
  }

  if (
    mode === 'discount' &&
    !errors.percentage &&
    percentage !== null &&
    percentage > 100
  ) {
    errors.percentage = t('pcAtMost100')
  }

  if (mode === 'relation' && !errors.amount && amount === 0) {
    errors.amount = t('pcWholeNotZero')
  }

  return errors
}

/** Ready to answer: both boxes filled, neither complaining. */
export function isAnswerable(
  percentageRaw: string,
  amountRaw: string,
  errors: PercentageErrors,
): boolean {
  return (
    parseNumber(percentageRaw) !== null &&
    parseNumber(amountRaw) !== null &&
    !errors.percentage &&
    !errors.amount
  )
}
