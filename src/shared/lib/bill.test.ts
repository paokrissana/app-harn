import { describe, expect, it } from 'vitest'

import {
  calculateBill,
  discountTotal,
  feeAfterPromos,
  foodFor,
  foodTotal,
  type Bill,
} from './bill'

/**
 * The real Grab order this feature was designed around.
 *
 * Alex, Bianca and Carlos each ordered a main. The gyoza sits under Alex but he
 * halves it with Bianca; the soup sits under Carlos but he halves it with
 * Bianca. Alex paid. Prices are made up, the shape is not.
 */
const grabOrder: Bill = {
  participants: [
    { id: 'alex', name: 'Alex' },
    { id: 'bianca', name: 'Bianca' },
    { id: 'carlos', name: 'Carlos' },
  ],
  items: [
    {
      id: '1',
      title: 'Fried rice',
      amount: 80,
      addedBy: 'alex',
      sharedBy: ['alex'],
    },
    {
      id: '2',
      title: 'Gyoza',
      amount: 120,
      addedBy: 'alex',
      sharedBy: ['alex', 'bianca'],
    },
    {
      id: '3',
      title: 'Chicken rice',
      amount: 90,
      addedBy: 'bianca',
      sharedBy: ['bianca'],
    },
    {
      id: '4',
      title: 'Noodles',
      amount: 100,
      addedBy: 'carlos',
      sharedBy: ['carlos'],
    },
    {
      id: '5',
      title: 'Soup',
      amount: 60,
      addedBy: 'carlos',
      sharedBy: ['bianca', 'carlos'],
    },
  ],
  fees: [{ id: 'delivery', label: 'Delivery', amount: 45, split: 'even' }],
  discounts: [
    { id: 'd1', kind: 'percent', value: 10 },
    { id: 'd2', kind: 'amount', value: 30 },
  ],
  payerId: 'alex',
}

const totalFor = (bill: Bill, id: string) =>
  calculateBill(bill).participants.find((p) => p.participantId === id)?.total

describe('foodFor', () => {
  it('halves an item between the two people sharing it', () => {
    // gyoza 120 sits under Alex but is halved with Bianca
    expect(foodFor('alex', grabOrder.items)).toBe(140) // 80 + 60
    expect(foodFor('bianca', grabOrder.items)).toBe(180) // 90 + 60 + 30
    expect(foodFor('carlos', grabOrder.items)).toBe(130) // 100 + 30
  })

  it('adds up to the whole order', () => {
    const shares = grabOrder.participants.map((p) =>
      foodFor(p.id, grabOrder.items),
    )
    expect(shares.reduce((a, b) => a + b, 0)).toBe(foodTotal(grabOrder.items))
  })

  it('ignores who added an item — only who shares it', () => {
    // the soup is under Carlos, but Bianca carries half of it
    const soup = grabOrder.items.filter((item) => item.title === 'Soup')
    expect(foodFor('bianca', soup)).toBe(30)
    expect(foodFor('carlos', soup)).toBe(30)
  })

  it('falls back to whoever added an item when nobody is ticked', () => {
    const orphan = [
      { id: 'x', title: 'Tea', amount: 40, addedBy: 'carlos', sharedBy: [] },
    ]
    expect(foodFor('carlos', orphan)).toBe(40)
    expect(foodFor('alex', orphan)).toBe(0)
  })
})

describe('discountTotal', () => {
  it('takes every percentage off the original amount, not each other', () => {
    // 10% + 10% of 100 is 20 off, not 19
    expect(
      discountTotal(
        [
          { id: 'a', kind: 'percent', value: 10 },
          { id: 'b', kind: 'percent', value: 10 },
        ],
        100,
      ),
    ).toBe(20)
  })

  it('adds percentages and flat amounts together', () => {
    expect(
      discountTotal(
        [
          { id: 'a', kind: 'percent', value: 10 },
          { id: 'b', kind: 'amount', value: 30 },
        ],
        450,
      ),
    ).toBe(75) // 45 + 30
  })

  it('never discounts past nothing', () => {
    expect(
      discountTotal([{ id: 'a', kind: 'amount', value: 500 }], 100),
    ).toBe(100)
  })

  it('is nothing when there are no promos', () => {
    expect(discountTotal([], 450)).toBe(0)
  })
})

describe('feeAfterPromos', () => {
  it('leaves a fee alone when it has no promo', () => {
    expect(
      feeAfterPromos({
        id: 'delivery',
        label: 'Delivery',
        amount: 45,
        split: 'even',
      }),
    ).toBe(45)
  })

  it('applies a free-delivery promo to the fee, not the food', () => {
    expect(
      feeAfterPromos({
        id: 'delivery',
        label: 'Delivery',
        amount: 45,
        split: 'even',
        promos: [{ id: 'free', kind: 'percent', value: 100 }],
      }),
    ).toBe(0)
  })

  it('takes a flat promo off the fee', () => {
    expect(
      feeAfterPromos({
        id: 'delivery',
        label: 'Delivery',
        amount: 45,
        split: 'even',
        promos: [{ id: 'p', kind: 'amount', value: 20 }],
      }),
    ).toBe(25)
  })
})

describe('calculateBill, on the real Grab order', () => {
  const result = calculateBill(grabOrder)

  it('totals the order the way the receipt does', () => {
    expect(result.foodTotal).toBe(450)
    expect(result.feesTotal).toBe(45)
    expect(result.discountTotal).toBe(75) // 10% of 450, plus 30
    expect(result.grandTotal).toBe(420) // 450 + 45 − 75
  })

  it('gives everyone their share in whole Baht', () => {
    expect(totalFor(grabOrder, 'alex')).toBe(132)
    expect(totalFor(grabOrder, 'bianca')).toBe(165)
    expect(totalFor(grabOrder, 'carlos')).toBe(123)
  })

  it('splits the delivery fee evenly', () => {
    for (const share of result.participants) {
      expect(share.fees).toBeCloseTo(15, 5) // 45 over three
    }
  })

  it('takes the discount off in proportion to what each ordered', () => {
    const discounts = Object.fromEntries(
      result.participants.map((p) => [p.participantId, p.discount]),
    )
    expect(discounts.alex).toBeCloseTo(23.333, 3) // 75 × 140/450
    expect(discounts.bianca).toBeCloseTo(30, 5) // 75 × 180/450
    expect(discounts.carlos).toBeCloseTo(21.667, 3) // 75 × 130/450
  })

  it('adds up to exactly what the payer paid', () => {
    const sum = result.participants.reduce((a, p) => a + p.total, 0)
    expect(sum).toBe(result.grandTotal)
  })

  it('asks everyone but the payer to transfer', () => {
    expect(result.transfers).toEqual([
      { from: 'bianca', to: 'alex', amount: 165 },
      { from: 'carlos', to: 'alex', amount: 123 },
    ])
  })
})

describe('calculateBill, when the group is bigger than the people listed', () => {
  /** The same three, but seven colleagues actually ordered together. */
  const ofSeven = { ...grabOrder, headcount: 7 }

  it('divides an evenly split fee by the whole group, not the people listed', () => {
    const result = calculateBill(ofSeven)

    for (const share of result.participants) {
      expect(share.fees).toBeCloseTo(45 / 7, 5) // 6.43, not 15
    }
    // the listed three carry three sevenths of the fee between them
    expect(result.feesTotal).toBeCloseTo(45 * (3 / 7), 5)
  })

  it('gives the listed people only their slice of a flat discount', () => {
    const flatOnly = { ...ofSeven, discounts: [grabOrder.discounts[1]] } // 30
    const result = calculateBill(flatOnly)

    expect(result.discountTotal).toBeCloseTo(30 * (3 / 7), 5) // 12.86
  })

  it('leaves a percentage discount alone, since it already is their share', () => {
    const percentOnly = { ...ofSeven, discounts: [grabOrder.discounts[0]] } // 10%
    expect(calculateBill(percentOnly).discountTotal).toBeCloseTo(45, 5)
  })

  it('covers only their part of the order', () => {
    const result = calculateBill(ofSeven)
    // 450 food + 19.29 of the fee − (45 + 12.86) of discount
    expect(result.grandTotal).toBeCloseTo(411.43, 2)
    expect(
      result.participants.reduce((sum, share) => sum + share.total, 0),
    ).toBeCloseTo(result.grandTotal, 5)
  })

  it('asks the others for whole Baht and leaves the change with the payer', () => {
    const result = calculateBill(ofSeven)
    const owed = Object.fromEntries(
      result.participants.map((share) => [share.participantId, share.total]),
    )

    expect(owed.bianca).toBe(163)
    expect(owed.carlos).toBe(120)
    expect(owed.alex).toBeCloseTo(411.43 - 283, 2)
  })

  it('changes nothing when the count matches the people listed', () => {
    expect(calculateBill({ ...grabOrder, headcount: 3 })).toEqual(
      calculateBill(grabOrder),
    )
  })

  it('refuses to go below the people listed', () => {
    expect(calculateBill({ ...grabOrder, headcount: 1 })).toEqual(
      calculateBill(grabOrder),
    )
  })
})

describe('calculateBill, rounding', () => {
  /** Three people, 100 of food each, and a fee that will not divide. */
  const awkward: Bill = {
    participants: [
      { id: 'a', name: 'A' },
      { id: 'b', name: 'B' },
      { id: 'c', name: 'C' },
    ],
    items: [
      { id: '1', title: 'A', amount: 100, addedBy: 'a', sharedBy: ['a'] },
      { id: '2', title: 'B', amount: 100, addedBy: 'b', sharedBy: ['b'] },
      { id: '3', title: 'C', amount: 100, addedBy: 'c', sharedBy: ['c'] },
    ],
    fees: [{ id: 'delivery', label: 'Delivery', amount: 10, split: 'even' }],
    discounts: [],
    payerId: 'a',
  }

  it('rounds the people who have to transfer', () => {
    // 100 + 3.33 each
    expect(totalFor(awkward, 'b')).toBe(103)
    expect(totalFor(awkward, 'c')).toBe(103)
  })

  it('leaves the odd change with the payer, so nothing goes missing', () => {
    const result = calculateBill(awkward)
    expect(result.grandTotal).toBe(310)
    expect(totalFor(awkward, 'a')).toBe(104) // 310 − 103 − 103
    expect(result.participants.reduce((sum, p) => sum + p.total, 0)).toBe(310)
  })
})

describe('calculateBill, fees that scale with the order', () => {
  const withServiceFee: Bill = {
    ...grabOrder,
    fees: [
      { id: 'delivery', label: 'Delivery', amount: 45, split: 'even' },
      { id: 'service', label: 'Service', amount: 45, split: 'proportional' },
    ],
    discounts: [],
  }

  it('splits a proportional fee by what each person ordered', () => {
    const result = calculateBill(withServiceFee)
    const fees = Object.fromEntries(
      result.participants.map((p) => [p.participantId, p.fees]),
    )
    // 15 each of delivery, plus 45 × their share of the food
    expect(fees.alex).toBeCloseTo(15 + 14, 5) // 45 × 140/450
    expect(fees.bianca).toBeCloseTo(15 + 18, 5) // 45 × 180/450
    expect(fees.carlos).toBeCloseTo(15 + 13, 5) // 45 × 130/450
  })

  it('still adds up', () => {
    const result = calculateBill(withServiceFee)
    expect(result.grandTotal).toBe(540) // 450 + 45 + 45
    expect(result.participants.reduce((sum, p) => sum + p.total, 0)).toBe(540)
  })
})

describe('calculateBill, edge cases', () => {
  it('handles an order with nothing in it', () => {
    const empty: Bill = {
      participants: [{ id: 'a', name: 'A' }],
      items: [],
      fees: [],
      discounts: [{ id: 'd', kind: 'percent', value: 10 }],
      payerId: 'a',
    }
    const result = calculateBill(empty)
    expect(result.grandTotal).toBe(0)
    expect(result.discountTotal).toBe(0)
    expect(result.transfers).toEqual([])
  })

  it('asks for no transfer from someone who owes nothing', () => {
    const soloDiner: Bill = {
      participants: [
        { id: 'a', name: 'A' },
        { id: 'b', name: 'B' },
      ],
      items: [
        { id: '1', title: 'Rice', amount: 100, addedBy: 'a', sharedBy: ['a'] },
      ],
      fees: [],
      discounts: [],
      payerId: 'a',
    }
    expect(calculateBill(soloDiner).transfers).toEqual([])
    expect(totalFor(soloDiner, 'b')).toBe(0)
  })

  it('does not fall over without participants', () => {
    const nobody: Bill = {
      participants: [],
      items: [],
      fees: [],
      discounts: [],
      payerId: 'a',
    }
    expect(calculateBill(nobody).participants).toEqual([])
  })
})
