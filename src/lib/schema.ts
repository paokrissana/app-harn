import { z } from 'zod'

/**
 * A required, non-negative numeric text field. Kept as a string on the form
 * (so inputs stay controlled and empty by default) and transformed to a number
 * on submit.
 */
const moneyField = z
  .string()
  .trim()
  .min(1, 'Required')
  .refine((v) => !Number.isNaN(Number(v)), 'Numbers only')
  .refine((v) => Number(v) >= 0, 'Cannot be negative')
  .transform((v) => Number(v))

/** A required whole number of at least 1 (how many people share a dish). */
const shareCountField = z
  .string()
  .trim()
  .min(1, 'Required')
  .refine((v) => !Number.isNaN(Number(v)), 'Numbers only')
  .refine((v) => Number.isInteger(Number(v)), 'Whole number')
  .refine((v) => Number(v) >= 1, 'At least 1')
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

export const paybackSchema = z
  .object({
    totalBill: moneyField,
    items: z.array(plateSchema).min(1, 'Add at least one plate'),
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
    {
      error: 'Your plates must total more than zero',
      path: ['items'],
    },
  )

/** Form field values (before transform) — all text inputs. */
export type PaybackFormInput = z.input<typeof paybackSchema>

/** Parsed values (after transform) — numbers, passed to the calculator. */
export type PaybackFormOutput = z.output<typeof paybackSchema>
