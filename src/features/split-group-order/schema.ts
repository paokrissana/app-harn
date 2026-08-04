import { z } from 'zod'

import type { Bill } from '@/shared/lib/bill'
import type { TranslationKey } from '@/i18n/translations'

type Translate = (
  key: TranslationKey,
  params?: Record<string, string | number>,
) => string

/**
 * The group-order form, shaped like the delivery receipt it is copied from:
 * people, then lines filed under whoever tapped them, then fees and promos.
 *
 * Validation messages are translated, so the schema is rebuilt when the
 * language changes.
 */
export function createGroupOrderSchema(t: Translate) {
  const money = z
    .string()
    .trim()
    .min(1, t('required'))
    .refine((v) => !Number.isNaN(Number(v)), t('numbersOnly'))
    .refine((v) => Number(v) >= 0, t('cannotBeNegative'))
    .transform((v) => Number(v))

  const promoSchema = z.object({
    id: z.string(),
    kind: z.enum(['percent', 'amount']),
    value: money,
  })

  const personSchema = z.object({
    id: z.string(),
    name: z.string().trim().min(1, t('required')),
  })

  const itemSchema = z.object({
    id: z.string(),
    title: z.string().trim(),
    price: money,
    /** Whose part of the receipt the line sits under. */
    addedBy: z.string(),
    /** Who actually splits it — at least one person. */
    sharedBy: z.array(z.string()).min(1, t('goItemNeedsSharer')),
  })

  /** A whole number of people, at least one. */
  const headcountField = z
    .string()
    .trim()
    .min(1, t('required'))
    .refine((v) => !Number.isNaN(Number(v)), t('numbersOnly'))
    .refine((v) => Number.isInteger(Number(v)), t('wholeNumber'))
    .refine((v) => Number(v) >= 1, t('atLeast1'))
    .transform((v) => Number(v))

  return z
    .object({
      people: z.array(personSchema).min(2, t('goAtLeastTwoPeople')),
      /** How many ordered altogether — more than `people` when only some are listed. */
      headcount: headcountField,
      items: z.array(itemSchema).min(1, t('goAddAtLeastOneItem')),
      deliveryFee: money,
      deliveryPromos: z.array(promoSchema),
      discounts: z.array(promoSchema),
      payerId: z.string(),
    })
    .superRefine((data, ctx) => {
      const food = data.items.reduce((sum, item) => sum + item.price, 0)

      // The group cannot be smaller than the people in it.
      if (data.headcount < data.people.length) {
        ctx.addIssue({
          code: 'custom',
          message: t('goHeadcountTooSmall', { count: data.people.length }),
          path: ['headcount'],
        })
      }
      if (food <= 0) {
        ctx.addIssue({
          code: 'custom',
          message: t('goItemsPositive'),
          path: ['items'],
        })
      }

      /*
       * Nothing can discount the food to less than nothing. Flat discounts are
       * weighed by the slice of the group that is listed, exactly as the engine
       * does, so the check matches what will actually be taken off.
       */
      const covered =
        data.headcount > 0
          ? Math.min(data.people.length / data.headcount, 1)
          : 1
      const off = data.discounts.reduce(
        (sum, discount) =>
          sum +
          (discount.kind === 'percent'
            ? food * (discount.value / 100)
            : discount.value * covered),
        0,
      )
      if (food > 0 && off > food) {
        ctx.addIssue({
          code: 'custom',
          message: t('goDiscountTooBig'),
          path: ['discounts'],
        })
      }

      // Somebody has to have paid, and it has to be one of these people.
      if (!data.people.some((person) => person.id === data.payerId)) {
        ctx.addIssue({
          code: 'custom',
          message: t('goPayerRequired'),
          path: ['payerId'],
        })
      }

      // A line cannot be shared with someone who left the group.
      const ids = new Set(data.people.map((person) => person.id))
      data.items.forEach((item, index) => {
        if (item.sharedBy.some((id) => !ids.has(id))) {
          ctx.addIssue({
            code: 'custom',
            message: t('goItemNeedsSharer'),
            path: ['items', index, 'sharedBy'],
          })
        }
      })
    })
}

type GroupOrderSchema = ReturnType<typeof createGroupOrderSchema>

/** Form values — every box holds text. */
export type GroupOrderFormInput = z.input<GroupOrderSchema>

/** Parsed values — numbers, ready for the engine. */
export type GroupOrderFormOutput = z.output<GroupOrderSchema>

/**
 * Map the form onto the shared Bill model.
 *
 * The delivery fee is `even` because it buys the trip rather than the food, and
 * its promos hang off the fee so a free-delivery voucher can never reach
 * anyone's items.
 */
export function toBill(values: GroupOrderFormOutput): Bill {
  return {
    participants: values.people.map((person) => ({
      id: person.id,
      name: person.name,
    })),
    items: values.items.map((item) => ({
      id: item.id,
      title: item.title,
      amount: item.price,
      addedBy: item.addedBy,
      sharedBy: item.sharedBy,
    })),
    fees: [
      {
        id: 'delivery',
        // Display comes from the translations; this is just a handle.
        label: 'delivery',
        amount: values.deliveryFee,
        split: 'even',
        promos: values.deliveryPromos,
      },
    ],
    discounts: values.discounts,
    payerId: values.payerId,
    headcount: values.headcount,
  }
}
