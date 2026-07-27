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

  /**
   * A percentage that can be switched off. Kept as a raw string here — it is
   * only validated when its toggle is on, which needs the sibling boolean, so
   * the checks live in the object-level refinement below.
   */
  const percentField = z.string().trim()

  /** Validate one percentage field, but only while its toggle is on. */
  const checkPercent = (
    ctx: z.RefinementCtx,
    enabled: boolean,
    value: string,
    path: string,
  ) => {
    if (!enabled) return
    const issue = (message: string) =>
      ctx.addIssue({ code: 'custom', message, path: [path] })

    if (value === '') issue(t('required'))
    else if (Number.isNaN(Number(value))) issue(t('numbersOnly'))
    else if (Number(value) < 0) issue(t('cannotBeNegative'))
  }

  return z
    .object({
      totalBill: moneyField,
      items: z.array(plateSchema).min(1, t('addAtLeastOnePlate')),
      sharedItems: z.array(sharedPlateSchema),
      serviceChargeEnabled: z.boolean(),
      serviceChargePct: percentField,
      vatEnabled: z.boolean(),
      vatPct: percentField,
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
    .superRefine((data, ctx) => {
      checkPercent(
        ctx,
        data.serviceChargeEnabled,
        data.serviceChargePct,
        'serviceChargePct',
      )
      checkPercent(ctx, data.vatEnabled, data.vatPct, 'vatPct')
    })
    .transform((data) => ({
      ...data,
      // A switched-off charge contributes nothing, whatever is left in its box.
      serviceChargePct: data.serviceChargeEnabled
        ? Number(data.serviceChargePct)
        : 0,
      vatPct: data.vatEnabled ? Number(data.vatPct) : 0,
    }))
}

type PaybackSchema = ReturnType<typeof createPaybackSchema>

/** Form field values (before transform) — all text inputs. */
export type PaybackFormInput = z.input<PaybackSchema>

/** Parsed values (after transform) — numbers, passed to the calculator. */
export type PaybackFormOutput = z.output<PaybackSchema>
