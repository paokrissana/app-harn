import { z } from 'zod'

import {
  calculateBill,
  discountTotal,
  type Bill,
  type BillResult,
  type Discount,
} from '@/shared/lib/bill'
import { restaurantCharges } from '@/shared/lib/percentage'
import type { TranslationKey } from '@/i18n/translations'
import { PLATE_COLORS } from './session'

type Translate = (
  key: TranslationKey,
  params?: Record<string, string | number>,
) => string

/**
 * Validation for a sushi session, and the hand-off to the shared bill engine.
 *
 * Sushi only has to answer one question of its own — *how much food did each
 * person have, at this restaurant's prices* — and everything after that is
 * `bill.ts`: service charge and VAT as proportional fees, the discount,
 * rounding, and who transfers what to whom. There is no sushi-specific fee
 * maths anywhere.
 *
 * Validation messages are translated, so the schema is rebuilt when the
 * language changes.
 */
export function createSushiSchema(t: Translate) {
  const money = z
    .string()
    .trim()
    .min(1, t('required'))
    .refine((v) => !Number.isNaN(Number(v)), t('numbersOnly'))
    .refine((v) => Number(v) >= 0, t('cannotBeNegative'))
    .transform((v) => Number(v))

  /** A percentage that can be switched off — only checked while it is on. */
  const percentField = z.string().trim()

  const plateSchema = z.object({
    id: z.string().min(1),
    label: z.string().trim().min(1, t('required')),
    price: money,
    color: z.enum(PLATE_COLORS).nullable(),
  })

  const dinerSchema = z.object({
    id: z.string().min(1),
    name: z.string().trim().min(1, t('required')),
    // Counters can only make whole numbers, but a session restored from storage
    // could hold anything, so the rule is checked rather than assumed.
    counts: z.record(
      z.string(),
      z
        .number()
        .int(t('wholeNumber'))
        .nonnegative(t('cannotBeNegative')),
    ),
  })

  return z
    .object({
      restaurantId: z.string(),
      restaurantName: z.string().trim().min(1, t('ssRestaurantNameRequired')),
      plates: z.array(plateSchema).min(1, t('ssAtLeastOnePlate')),
      diners: z.array(dinerSchema).min(1, t('ssAtLeastOneDiner')),
      serviceChargeEnabled: z.boolean(),
      serviceChargePct: percentField,
      vatEnabled: z.boolean(),
      vatPct: percentField,
      discountKind: z.enum(['percent', 'amount']),
      discountValue: money,
      payerId: z.string(),
    })
    .superRefine((data, ctx) => {
      const issue = (message: string, path: (string | number)[]) =>
        ctx.addIssue({ code: 'custom', message, path })

      const checkCharge = (enabled: boolean, value: string, path: string) => {
        if (!enabled) return
        if (value === '') issue(t('required'), [path])
        else if (Number.isNaN(Number(value))) issue(t('numbersOnly'), [path])
        else if (Number(value) < 0) issue(t('cannotBeNegative'), [path])
      }
      checkCharge(
        data.serviceChargeEnabled,
        data.serviceChargePct,
        'serviceChargePct',
      )
      checkCharge(data.vatEnabled, data.vatPct, 'vatPct')

      // Ids are generated, but a restored session is outside our control.
      const plateIds = data.plates.map((plate) => plate.id)
      if (new Set(plateIds).size !== plateIds.length) {
        issue(t('ssDuplicatePlate'), ['plates'])
      }
      const dinerIds = data.diners.map((diner) => diner.id)
      if (new Set(dinerIds).size !== dinerIds.length) {
        issue(t('ssDuplicateDiner'), ['diners'])
      }

      if (!data.diners.some((diner) => diner.id === data.payerId)) {
        issue(t('ssPayerRequired'), ['payerId'])
      }

      const food = foodTotalOf(data)
      if (food <= 0) issue(t('ssNoPlatesCounted'), ['diners'])

      if (data.discountKind === 'percent' && data.discountValue > 100) {
        issue(t('goPercentAtMost100'), ['discountValue'])
      }
      if (data.discountKind === 'amount' && food > 0 && data.discountValue > food) {
        issue(t('ssDiscountTooBig'), ['discountValue'])
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

type SushiSchema = ReturnType<typeof createSushiSchema>

/** A session after validation — numbers, ready for the engine. */
export type ParsedSession = z.output<SushiSchema>

/** The shape `foodTotalOf` needs, so it works before and after parsing. */
interface Countable {
  plates: { id: string; price: number }[]
  diners: { counts: Record<string, number> }[]
}

/** Everything eaten at the table, at this session's prices. */
export function foodTotalOf(session: Countable): number {
  const price = new Map(session.plates.map((plate) => [plate.id, plate.price]))

  return session.diners.reduce(
    (sum, diner) =>
      sum +
      Object.entries(diner.counts).reduce(
        (own, [plateId, quantity]) => own + quantity * (price.get(plateId) ?? 0),
        0,
      ),
    0,
  )
}

/** Each step of the bill, in the order Harn applies them. */
export interface SushiCharges {
  food: number
  discount: number
  /** What the service charge and VAT are worked out on: food less discount. */
  afterDiscount: number
  serviceCharge: number
  vat: number
  grandTotal: number
}

/**
 * The bill-level figures, **discount first**.
 *
 * Thai VAT is charged on what was actually paid for the goods, after any
 * discount given at the time of sale — so the discount comes off the food, and
 * service charge and VAT are worked out on what is left. Taking the discount
 * off at the end instead would charge VAT on money nobody paid, and on a
 * ฿1,200 bill with ฿100 off it lands ฿17.70 higher.
 *
 * This is the Harn-wide order, recorded in CLAUDE.md, not a sushi quirk.
 */
export function chargesOf(session: ParsedSession): SushiCharges {
  const food = foodTotalOf(session)
  const discount = discountTotal([discountOf(session)], food)
  const afterDiscount = food - discount
  const { serviceCharge, vat, total } = restaurantCharges(
    afterDiscount,
    session.serviceChargePct,
    session.vatPct,
  )

  return { food, discount, afterDiscount, serviceCharge, vat, grandTotal: total }
}

function discountOf(session: ParsedSession): Discount {
  return {
    id: 'discount',
    kind: session.discountKind,
    value: session.discountValue,
    allocation: 'proportional',
  }
}

/**
 * Map a session onto the shared Bill model.
 *
 * Every person's plates become their own items — one per plate type they had,
 * shared by nobody else. The charges arrive already worked out, as proportional
 * fees: everyone's food is discounted by the same fraction, so a share of the
 * fees by food is also a share by discounted food, and the two cannot disagree.
 */
export function toBill(session: ParsedSession): Bill {
  const charges = chargesOf(session)
  const price = new Map(session.plates.map((plate) => [plate.id, plate]))

  const items = session.diners.flatMap((diner) =>
    Object.entries(diner.counts)
      .filter(([, quantity]) => quantity > 0)
      .flatMap(([plateId, quantity]) => {
        const plate = price.get(plateId)
        if (!plate) return []
        return [
          {
            id: `${diner.id}:${plateId}`,
            title: plate.label,
            amount: quantity * plate.price,
            addedBy: diner.id,
            sharedBy: [diner.id],
          },
        ]
      }),
  )

  return {
    participants: session.diners.map((diner) => ({
      id: diner.id,
      name: diner.name,
    })),
    items,
    fees: [
      {
        id: 'service-charge',
        label: 'serviceCharge',
        amount: charges.serviceCharge,
        split: 'proportional',
      },
      { id: 'vat', label: 'vat', amount: charges.vat, split: 'proportional' },
    ],
    discounts: charges.discount > 0 ? [discountOf(session)] : [],
    payerId: session.payerId,
  }
}

/** The whole answer: the bill-level steps, and what everyone owes. */
export interface SushiSplitResult {
  charges: SushiCharges
  bill: BillResult
}

/** Work out a validated session. Pure — same session in, same answer out. */
export function calculateSushiSplit(session: ParsedSession): SushiSplitResult {
  return { charges: chargesOf(session), bill: calculateBill(toBill(session)) }
}
