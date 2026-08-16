/**
 * The shared calculation engine: a Bill in, everyone's share out.
 *
 * Framework independent — no React, no UI, pure functions only. Every
 * calculator maps its own form onto this Bill model.
 */

/** Someone splitting the order. */
export interface Participant {
  id: string
  name: string
}

/**
 * One line of the order.
 *
 * `addedBy` and `sharedBy` are different facts, and a delivery app only shows
 * the first: on Grab, gyoza tapped by Alex sits under Alex even when he and
 * Bianca are halving it. `addedBy` keeps the form looking like the receipt;
 * `sharedBy` is what the money follows.
 */
export interface BillItem {
  id: string
  title: string
  amount: number
  /** Whose part of the receipt this appears under. Never affects the money. */
  addedBy: string
  /** Who splits it, evenly. Falls back to `addedBy` when left empty. */
  sharedBy: string[]
}

/** A promo, as a percentage of what it comes off or as a flat sum of Baht. */
export interface Discount {
  id: string
  kind: 'percent' | 'amount'
  value: number
}

/**
 * How a fee is divided: `even` per head for fees that buy the whole order
 * (delivery, small-order), `proportional` for fees that scale with what each
 * person ordered (a percentage service fee, a tip).
 */
export type FeeSplit = 'even' | 'proportional'

export interface Fee {
  id: string
  label: string
  amount: number
  split: FeeSplit
  /**
   * Promos off this fee — a free-delivery voucher belongs here, not in the
   * bill's discounts. Applied before the fee is split, never below zero.
   */
  promos?: Discount[]
}

export interface Bill {
  participants: Participant[]
  items: BillItem[]
  fees: Fee[]
  /** Promos off the food. Percentages come off the original food total. */
  discounts: Discount[]
  /** Who fronted the money; everyone else transfers to them. */
  payerId: string
  /**
   * How many people the order was split across, when that is more than the
   * people listed — seven colleagues ordering together while only three of them
   * shared dishes and need working out. Defaults to the number listed, and is
   * never taken below it.
   *
   * Above that number, the listed people carry only their slice of the evenly
   * split fees and of any flat discount, and the result covers their part of
   * the order rather than the whole bill.
   */
  headcount?: number
}

/** What one person ends up owing, and why. */
export interface ParticipantTotal {
  participantId: string
  food: number
  fees: number
  discount: number
  /**
   * What they owe. Whole Baht for everyone but the payer, who carries the odd
   * change so the totals still add up to the real bill.
   */
  total: number
}

export interface Transfer {
  from: string
  to: string
  amount: number
}

/** One person's cut of a plate they did not order themselves. */
export interface PlateShare {
  participantId: string
  amount: number
}

/**
 * A plate more than one person is in on, and what the others owe for it.
 *
 * Your own lines you already know the price of; the shared ones are the part
 * that needs working out, so they are worth pulling out and naming separately.
 * Amounts are at menu price — fees and promos belong to the totals, not here.
 */
export interface SharedPlate {
  itemId: string
  title: string
  /** The whole plate, as the receipt prices it. */
  amount: number
  /** Whose part of the receipt it sits under, so who the others pay back. */
  addedBy: string
  /** Everyone splitting it, `addedBy` included. */
  sharers: string[]
  /** What each of the others owes `addedBy` — an even cut, one line each. */
  shares: PlateShare[]
}

export interface BillResult {
  foodTotal: number
  /** The listed people's share of the fees, after each fee's own promos. */
  feesTotal: number
  discountTotal: number
  /**
   * What the listed people owe between them: food + fees − discounts. Equals
   * the whole bill when everybody who ordered is listed, and only their part
   * of it when `headcount` says the group was bigger.
   */
  grandTotal: number
  participants: ParticipantTotal[]
  transfers: Transfer[]
}

/** Who splits an item — whoever added it, if nobody was ticked. */
function sharersOf(item: BillItem): string[] {
  return item.sharedBy.length > 0 ? item.sharedBy : [item.addedBy]
}

/** Everything ordered, before fees and promos. */
export function foodTotal(items: BillItem[]): number {
  return items.reduce((sum, item) => sum + item.amount, 0)
}

/** One person's food: their own lines plus an even slice of anything shared. */
export function foodFor(participantId: string, items: BillItem[]): number {
  return items.reduce((sum, item) => {
    const sharers = sharersOf(item)
    if (!sharers.includes(participantId)) return sum
    return sum + item.amount / sharers.length
  }, 0)
}

/**
 * The plates with more than one name on them, each with what the others owe
 * whoever ordered it. Plates nobody shared are left out — there is nothing to
 * settle on a line you ate alone.
 *
 * `addedBy` need not be among the sharers: a plate filed under Alex but ticked
 * for Bianca and Carlos alone leaves both of them owing Alex, and Alex nothing.
 */
export function sharedPlates(items: BillItem[]): SharedPlate[] {
  return items.flatMap((item) => {
    const sharers = sharersOf(item)
    if (sharers.length < 2) return []

    const each = item.amount / sharers.length

    return [
      {
        itemId: item.id,
        title: item.title,
        amount: item.amount,
        addedBy: item.addedBy,
        sharers,
        shares: sharers
          .filter((participantId) => participantId !== item.addedBy)
          .map((participantId) => ({ participantId, amount: each })),
      },
    ]
  })
}

/**
 * What a list of promos takes off `base`. Every percentage is taken from the
 * base as given, so two promos on one bill do not compound — that is how a
 * receipt lists them, as separate deductions that add up. Capped at the base,
 * since nothing can discount to less than nothing.
 *
 * `flatShare` scales the flat amounts only, for when the people listed are part
 * of a bigger group: a percentage off their food is already their share of it,
 * but a flat 30 off a seven-person order is not.
 */
export function discountTotal(
  discounts: Discount[],
  base: number,
  flatShare = 1,
): number {
  const off = discounts.reduce(
    (sum, discount) =>
      sum +
      (discount.kind === 'percent'
        ? base * (discount.value / 100)
        : discount.value * flatShare),
    0,
  )
  return Math.min(off, base)
}

/** A fee once its own promos are off it. */
export function feeAfterPromos(fee: Fee): number {
  return fee.amount - discountTotal(fee.promos ?? [], fee.amount)
}

/**
 * Work out what everyone owes and who transfers what to whom.
 *
 * Non-payers are rounded to whole Baht — nobody transfers satang — and the
 * payer absorbs the difference, so the shares always sum to the real bill.
 */
export function calculateBill(bill: Bill): BillResult {
  const { participants, items, fees, discounts, payerId } = bill

  const listed = participants.length
  // Somebody has to be carrying the order, so never fewer heads than people.
  const headcount = Math.max(bill.headcount ?? listed, listed)
  /** The slice of the order the listed people carry between them. */
  const covered = headcount > 0 ? listed / headcount : 1

  const food = foodTotal(items)
  const charged = fees.map((fee) => ({
    fee,
    // Their slice of the fee; the rest belongs to the people not listed.
    amount: feeAfterPromos(fee) * covered,
  }))
  const feesTotal = charged.reduce((sum, { amount }) => sum + amount, 0)
  const discounted = discountTotal(discounts, food, covered)
  const grandTotal = food + feesTotal - discounted

  if (listed === 0) {
    return {
      foodTotal: food,
      feesTotal,
      discountTotal: discounted,
      grandTotal,
      participants: [],
      transfers: [],
    }
  }

  const exact = participants.map((participant) => {
    const personFood = foodFor(participant.id, items)
    // No food means no basis for a proportional share, so it stays at nothing.
    const ratio = food > 0 ? personFood / food : 0
    const feeShare = charged.reduce(
      (sum, { fee, amount }) =>
        sum + (fee.split === 'even' ? amount / listed : amount * ratio),
      0,
    )

    return {
      participantId: participant.id,
      food: personFood,
      fees: feeShare,
      discount: discounted * ratio,
      exactTotal: personFood + feeShare - discounted * ratio,
    }
  })

  const owedByOthers = exact
    .filter((share) => share.participantId !== payerId)
    .reduce((sum, share) => sum + Math.round(share.exactTotal), 0)

  const totals: ParticipantTotal[] = exact.map(({ exactTotal, ...share }) => ({
    ...share,
    total:
      share.participantId === payerId
        ? grandTotal - owedByOthers
        : Math.round(exactTotal),
  }))

  const transfers: Transfer[] = totals
    .filter((share) => share.participantId !== payerId && share.total > 0)
    .map((share) => ({
      from: share.participantId,
      to: payerId,
      amount: share.total,
    }))

  return {
    foodTotal: food,
    feesTotal,
    discountTotal: discounted,
    grandTotal,
    participants: totals,
    transfers,
  }
}
