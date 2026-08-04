import { describe, expect, it } from 'vitest'

import { calculateBill } from '@/shared/lib/bill'
import {
  createGroupOrderSchema,
  toBill,
  type GroupOrderFormInput,
} from './schema'

/** Echo the key back, so tests assert which rule fired, not its wording. */
const t = (key: string) => key
const schema = createGroupOrderSchema(t as never)

/** Alex, Bianca and Carlos, with the gyoza and soup shared across sections. */
const form: GroupOrderFormInput = {
  people: [
    { id: 'alex', name: 'Alex' },
    { id: 'bianca', name: 'Bianca' },
    { id: 'carlos', name: 'Carlos' },
  ],
  headcount: '3',
  items: [
    {
      id: '1',
      title: 'Fried rice',
      price: '80',
      addedBy: 'alex',
      sharedBy: ['alex'],
    },
    {
      id: '2',
      title: 'Gyoza',
      price: '120',
      addedBy: 'alex',
      sharedBy: ['alex', 'bianca'],
    },
    {
      id: '3',
      title: 'Chicken rice',
      price: '90',
      addedBy: 'bianca',
      sharedBy: ['bianca'],
    },
    {
      id: '4',
      title: 'Noodles',
      price: '100',
      addedBy: 'carlos',
      sharedBy: ['carlos'],
    },
    {
      id: '5',
      title: 'Soup',
      price: '60',
      addedBy: 'carlos',
      sharedBy: ['bianca', 'carlos'],
    },
  ],
  deliveryFee: '45',
  deliveryPromos: [],
  discounts: [
    { id: 'd1', kind: 'percent', value: '10' },
    { id: 'd2', kind: 'amount', value: '30' },
  ],
  payerId: 'alex',
}

function errorsOn(input: GroupOrderFormInput, field: string): string[] {
  const result = schema.safeParse(input)
  if (result.success) return []

  return result.error.issues
    .filter((issue) => issue.path.join('.') === field)
    .map((issue) => issue.message)
}

describe('the group order form', () => {
  it('accepts the real order', () => {
    expect(schema.safeParse(form).success).toBe(true)
  })

  it('needs at least two people to split anything', () => {
    const alone = { ...form, people: [form.people[0]], payerId: 'alex' }
    expect(errorsOn(alone, 'people')).toEqual(['goAtLeastTwoPeople'])
  })

  it('needs every person named', () => {
    const unnamed = {
      ...form,
      people: [{ id: 'alex', name: '  ' }, ...form.people.slice(1)],
    }
    expect(errorsOn(unnamed, 'people.0.name')).toEqual(['required'])
  })

  it('needs at least one line', () => {
    expect(errorsOn({ ...form, items: [] }, 'items')).toContain(
      'goAddAtLeastOneItem',
    )
  })

  it('needs the order to come to something', () => {
    const free = {
      ...form,
      items: form.items.map((item) => ({ ...item, price: '0' })),
    }
    expect(errorsOn(free, 'items')).toEqual(['goItemsPositive'])
  })

  it('needs somebody on every line', () => {
    const orphan = {
      ...form,
      items: [{ ...form.items[0], sharedBy: [] }, ...form.items.slice(1)],
    }
    expect(errorsOn(orphan, 'items.0.sharedBy')).toEqual(['goItemNeedsSharer'])
  })

  it('rejects a line shared with somebody who is not in the group', () => {
    const ghost = {
      ...form,
      items: [
        { ...form.items[0], sharedBy: ['alex', 'dave'] },
        ...form.items.slice(1),
      ],
    }
    expect(errorsOn(ghost, 'items.0.sharedBy')).toEqual(['goItemNeedsSharer'])
  })

  it('needs the payer to be one of the group', () => {
    expect(errorsOn({ ...form, payerId: 'dave' }, 'payerId')).toEqual([
      'goPayerRequired',
    ])
    expect(errorsOn({ ...form, payerId: '' }, 'payerId')).toEqual([
      'goPayerRequired',
    ])
  })

  it('refuses a discount bigger than the order', () => {
    const tooMuch = {
      ...form,
      discounts: [{ id: 'd', kind: 'amount' as const, value: '500' }],
    }
    expect(errorsOn(tooMuch, 'discounts')).toEqual(['goDiscountTooBig'])
  })

  it('allows a discount that wipes the order out exactly', () => {
    const free = {
      ...form,
      discounts: [{ id: 'd', kind: 'amount' as const, value: '450' }],
    }
    expect(errorsOn(free, 'discounts')).toEqual([])
  })

  it('counts percentage and flat discounts together against the order', () => {
    const combined = {
      ...form,
      discounts: [
        { id: 'a', kind: 'percent' as const, value: '90' }, // 405
        { id: 'b', kind: 'amount' as const, value: '100' }, // 505 > 450
      ],
    }
    expect(errorsOn(combined, 'discounts')).toEqual(['goDiscountTooBig'])
  })

  it('rejects a negative fee', () => {
    expect(errorsOn({ ...form, deliveryFee: '-10' }, 'deliveryFee')).toEqual([
      'cannotBeNegative',
    ])
  })
})

describe('toBill', () => {
  const values = schema.parse(form)

  it('carries who shares each line, not who added it', () => {
    const bill = toBill(values)
    const gyoza = bill.items.find((item) => item.title === 'Gyoza')

    expect(gyoza?.addedBy).toBe('alex')
    expect(gyoza?.sharedBy).toEqual(['alex', 'bianca'])
  })

  it('makes the delivery fee an evenly split fee, with its promos attached', () => {
    const withPromo = schema.parse({
      ...form,
      deliveryPromos: [{ id: 'p', kind: 'percent', value: '100' }],
    })
    const [fee] = toBill(withPromo).fees

    expect(fee.split).toBe('even')
    expect(fee.amount).toBe(45)
    expect(fee.promos).toEqual([{ id: 'p', kind: 'percent', value: 100 }])
  })

  it('feeds the engine so the real order comes out as expected', () => {
    const result = calculateBill(toBill(values))

    expect(result.grandTotal).toBe(420)
    expect(result.transfers).toEqual([
      { from: 'bianca', to: 'alex', amount: 165 },
      { from: 'carlos', to: 'alex', amount: 123 },
    ])
  })

  it('lets a free-delivery promo cancel the fee without touching the food', () => {
    const result = calculateBill(
      toBill(
        schema.parse({
          ...form,
          deliveryPromos: [{ id: 'p', kind: 'percent', value: '100' }],
        }),
      ),
    )

    expect(result.feesTotal).toBe(0)
    expect(result.foodTotal).toBe(450) // untouched
    expect(result.grandTotal).toBe(375) // 450 − 75
  })
})
