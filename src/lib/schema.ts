import { z } from 'zod'

import type { TranslationKey } from '@/i18n/translations'

type Translate = (key: TranslationKey) => string

/**
 * Build the payback form schema with translated validation messages.
 * Recreated when the language changes so error text follows the UI language.
 */
export function createPaybackSchema(t: Translate) {
  const moneyField = z
    .string()
    .trim()
    .min(1, t('required'))
    .refine((v) => !Number.isNaN(Number(v)), t('numbersOnly'))
    .refine((v) => Number(v) >= 0, t('cannotBeNegative'))
    .transform((v) => Number(v))

  const shareCountField = z
    .string()
    .trim()
    .min(1, t('required'))
    .refine((v) => !Number.isNaN(Number(v)), t('numbersOnly'))
    .refine((v) => Number.isInteger(Number(v)), t('wholeNumber'))
    .refine((v) => Number(v) >= 1, t('atLeast1'))
    .transform((v) => Number(v))

  const plateSchema = z.object({
    name: z.string().trim(),
    price: moneyField,
  })

  const sharedPlateSchema = z.object({
    name: z.string().trim(),
    price: moneyField,
    shares: shareCountField,
  })

  return z
    .object({
      totalBill: moneyField,
      items: z.array(plateSchema).min(1, t('addAtLeastOnePlate')),
      sharedItems: z.array(sharedPlateSchema),
      serviceChargePct: moneyField,
      vatPct: moneyField,
    })
    .refine(
      (data) => {
        const own = data.items.reduce((sum, item) => sum + item.price, 0)
        const shared = data.sharedItems.reduce(
          (sum, item) => sum + (item.shares > 0 ? item.price / item.shares : 0),
          0,
        )
        return own + shared > 0
      },
      { error: t('platesPositive'), path: ['items'] },
    )
}

type PaybackSchema = ReturnType<typeof createPaybackSchema>

/** Form field values (before transform) — all text inputs. */
export type PaybackFormInput = z.input<PaybackSchema>

/** Parsed values (after transform) — numbers, passed to the calculator. */
export type PaybackFormOutput = z.output<PaybackSchema>
