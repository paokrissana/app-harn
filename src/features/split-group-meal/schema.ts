import { z } from 'zod'

import type { Bill } from '@/shared/lib/bill'
import { formatBaht } from '@/shared/lib/money'
import type { TranslationKey } from '@/i18n/translations'

type Translate = (
  key: TranslationKey,
  params?: Record<string, string | number>,
) => string

/**
 * How far the entered dishes may exceed the printed total before it counts as a
 * mistake. Receipts round to the nearest baht, so allow one.
 */
const ROUNDING_ALLOWANCE = 1

/**
 * The group-meal form: everyone at the table, then the dishes, then the charges
 * printed at the bottom of the bill.
 *
 * Where Split Group Order copies a delivery receipt — every line already filed
 * under whoever tapped it — a restaurant bill has no such structure. It is one
 * list of dishes, most of them for the table, so sharing is the default here
 * and eating alone is the exception.
 *
 * Validation messages are translated, so the schema is rebuilt when the
 * language changes.
 */
export function createGroupMealSchema(t: Translate) {
  const money = z
    .string()
    .trim()
    .min(1, t('required'))
    .refine((v) => !Number.isNaN(Number(v)), t('numbersOnly'))
    .refine((v) => Number(v) >= 0, t('cannotBeNegative'))
    .transform((v) => Number(v))

  const personSchema = z.object({
    id: z.string(),
    name: z.string().trim().min(1, t('required')),
  })

  const dishSchema = z.object({
    id: z.string(),
    title: z.string().trim(),
    price: money,
    /** Who ate it — everyone by default, at least one person always. */
    sharedBy: z.array(z.string()).min(1, t('gmDishNeedsEater')),
  })

  /**
   * A percentage that can be switched off. Left as raw text here: it is only
   * validated while its toggle is on, and that needs the sibling boolean, so
   * the checks live in the refinement below.
   */
  const percentField = z.string().trim()

  /** Validate one charge field, but only while its toggle is on. */
  const checkCharge = (
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
      people: z.array(personSchema).min(2, t('gmAtLeastTwoPeople')),
      dishes: z.array(dishSchema).min(1, t('gmAddAtLeastOneDish')),
      /** What the bill says, as a guard. `0` means "I have not got it". */
      totalBill: money,
      serviceChargeEnabled: z.boolean(),
      serviceChargePct: percentField,
      vatEnabled: z.boolean(),
      vatPct: percentField,
      payerId: z.string(),
    })
    .superRefine((data, ctx) => {
      checkCharge(
        ctx,
        data.serviceChargeEnabled,
        data.serviceChargePct,
        'serviceChargePct',
      )
      checkCharge(ctx, data.vatEnabled, data.vatPct, 'vatPct')

      const food = data.dishes.reduce((sum, dish) => sum + dish.price, 0)
      if (food <= 0) {
        ctx.addIssue({
          code: 'custom',
          message: t('gmDishesPositive'),
          path: ['dishes'],
        })
      }

      // Somebody has to have paid, and it has to be one of these people.
      if (!data.people.some((person) => person.id === data.payerId)) {
        ctx.addIssue({
          code: 'custom',
          message: t('gmPayerRequired'),
          path: ['payerId'],
        })
      }

      // A dish cannot be shared with someone who has left the table.
      const ids = new Set(data.people.map((person) => person.id))
      data.dishes.forEach((dish, index) => {
        if (dish.sharedBy.some((id) => !ids.has(id))) {
          ctx.addIssue({
            code: 'custom',
            message: t('gmDishNeedsEater'),
            path: ['dishes', index, 'sharedBy'],
          })
        }
      })

      /*
       * Every dish typed in is printed on that bill, so charged up they cannot
       * come to more than the bill itself. This is the one check that catches a
       * mistyped price or a dish entered twice — without it nothing here knows
       * what the restaurant actually asked for. Skipped when the total is left
       * at 0, which means "I have not got the bill in front of me".
       */
      const serviceChargePct = data.serviceChargeEnabled
        ? Number(data.serviceChargePct)
        : 0
      const vatPct = data.vatEnabled ? Number(data.vatPct) : 0
      const percentagesUsable =
        Number.isFinite(serviceChargePct) && Number.isFinite(vatPct)

      if (data.totalBill > 0 && food > 0 && percentagesUsable) {
        const charged = chargedTotal(food, serviceChargePct, vatPct)

        if (charged > data.totalBill + ROUNDING_ALLOWANCE) {
          ctx.addIssue({
            code: 'custom',
            message: t('gmDishesOverBill', { amount: formatBaht(charged) }),
            path: ['totalBill'],
          })
        }
      }
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

/**
 * Food plus service charge plus VAT, in the order a Thai receipt applies them:
 * service charge on the food, then VAT on both. VAT is charged on the service
 * charge as well, which is why this cannot be a single combined percentage.
 */
export function chargedTotal(
  food: number,
  serviceChargePct: number,
  vatPct: number,
): number {
  const withService = food * (1 + serviceChargePct / 100)
  return withService * (1 + vatPct / 100)
}

type GroupMealSchema = ReturnType<typeof createGroupMealSchema>

/** Form values — every box holds text. */
export type GroupMealFormInput = z.input<GroupMealSchema>

/** Parsed values — numbers, ready for the engine. */
export type GroupMealFormOutput = z.output<GroupMealSchema>

/**
 * Map the form onto the shared Bill model.
 *
 * Both charges are `proportional`: they scale with what each person ate, unlike
 * a delivery fee which buys the trip and splits per head. VAT is worked out on
 * the food *and* the service charge, matching the receipt.
 *
 * Every dish is filed under the payer, because on a restaurant bill it really
 * is — one bill, one person settling it, and everyone else owing them.
 */
export function toBill(values: GroupMealFormOutput): Bill {
  const food = values.dishes.reduce((sum, dish) => sum + dish.price, 0)
  const serviceCharge = food * (values.serviceChargePct / 100)
  const vat = (food + serviceCharge) * (values.vatPct / 100)

  return {
    participants: values.people.map((person) => ({
      id: person.id,
      name: person.name,
    })),
    items: values.dishes.map((dish) => ({
      id: dish.id,
      title: dish.title,
      amount: dish.price,
      addedBy: values.payerId,
      sharedBy: dish.sharedBy,
    })),
    fees: [
      // Labels are handles for the engine; the display comes from translations.
      {
        id: 'service-charge',
        label: 'serviceCharge',
        amount: serviceCharge,
        split: 'proportional',
      },
      { id: 'vat', label: 'vat', amount: vat, split: 'proportional' },
    ],
    discounts: [],
    payerId: values.payerId,
  }
}
