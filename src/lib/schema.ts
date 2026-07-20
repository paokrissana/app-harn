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

export const calculatorSchema = z
  .object({
    payer: z.enum(['A', 'B']),
    foodA: moneyField,
    foodB: moneyField,
    serviceChargePct: moneyField,
    vatPct: moneyField,
  })
  .refine((data) => data.foodA + data.foodB > 0, {
    error: 'Food total cannot be zero',
    path: ['foodB'],
  })

/** Form field values (before transform) — all text inputs. */
export type CalculatorFormInput = z.input<typeof calculatorSchema>

/** Parsed values (after transform) — numbers, passed to the calculator. */
export type CalculatorFormOutput = z.output<typeof calculatorSchema>
