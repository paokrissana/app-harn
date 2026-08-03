import { describe, expect, it } from 'vitest'

import { createPaybackSchema, type PaybackFormInput } from './schema'

/** Echo the key back, so tests assert on which message fired, not its wording. */
const t = (key: string, params?: Record<string, string | number>) =>
  params ? `${key}:${Object.values(params).join(',')}` : key

const schema = createPaybackSchema(t as never)

const form: PaybackFormInput = {
  name: '',
  totalBill: '1177',
  items: [{ name: 'Pad Thai', price: '220' }],
  sharedItems: [],
  serviceChargeEnabled: true,
  serviceChargePct: '10',
  vatEnabled: true,
  vatPct: '7',
  tipEnabled: false,
  tipMode: 'percent',
  tipValue: '10',
}

/** The messages attached to one field, if the form was rejected. */
function errorsOn(input: PaybackFormInput, field: string): string[] {
  const result = schema.safeParse(input)
  if (result.success) return []

  return result.error.issues
    .filter((issue) => issue.path.join('.') === field)
    .map((issue) => issue.message)
}

describe('the tip field', () => {
  it('is not validated while the tip is switched off', () => {
    expect(errorsOn({ ...form, tipValue: '' }, 'tipValue')).toEqual([])
  })

  it('is required once the tip is switched on', () => {
    expect(
      errorsOn({ ...form, tipEnabled: true, tipValue: '' }, 'tipValue'),
    ).toEqual(['required'])
  })

  it('must be a non-negative number', () => {
    expect(
      errorsOn({ ...form, tipEnabled: true, tipValue: 'abc' }, 'tipValue'),
    ).toEqual(['numbersOnly'])
    expect(
      errorsOn({ ...form, tipEnabled: true, tipValue: '-5' }, 'tipValue'),
    ).toEqual(['cannotBeNegative'])
  })
})

describe('items against the total bill', () => {
  it('accepts a bill that covers the items', () => {
    expect(schema.safeParse(form).success).toBe(true)
  })

  it('rejects items that cost more than the whole bill', () => {
    // a 220 dish, charged up to 258.94, cannot sit on a bill of 200
    const errors = errorsOn({ ...form, totalBill: '200' }, 'totalBill')
    expect(errors).toHaveLength(1)
    expect(errors[0]).toBe('itemsOverBill:258.94 THB')
  })

  it('counts service charge and VAT against the bill', () => {
    // 220 alone fits in 240, but 220 + 10% + 7% = 258.94 does not
    expect(errorsOn({ ...form, totalBill: '240' }, 'totalBill')).toHaveLength(1)
    expect(
      errorsOn(
        {
          ...form,
          totalBill: '240',
          serviceChargeEnabled: false,
          vatEnabled: false,
        },
        'totalBill',
      ),
    ).toEqual([])
  })

  it('counts the whole price of a shared dish, not just your slice', () => {
    // your slice is only 900 / 4 = 225, but all 900 is printed on that bill
    const withShared: PaybackFormInput = {
      ...form,
      totalBill: '600',
      items: [{ name: 'Rice', price: '50' }],
      sharedItems: [{ name: 'Platter', price: '900', shares: '4' }],
      serviceChargeEnabled: false,
      vatEnabled: false,
    }
    expect(errorsOn(withShared, 'totalBill')).toHaveLength(1)
  })

  it('allows a baht of rounding, since receipts are rounded', () => {
    // items charge up to 258.94 against a bill printed as 258
    expect(errorsOn({ ...form, totalBill: '258' }, 'totalBill')).toEqual([])
    expect(errorsOn({ ...form, totalBill: '257' }, 'totalBill')).toHaveLength(1)
  })

  it('skips the check when the total is left at zero', () => {
    expect(errorsOn({ ...form, totalBill: '0' }, 'totalBill')).toEqual([])
  })

  it('never counts a tip against the bill — a tip is not printed on it', () => {
    // 220 of food fits a 258 bill; a 500 baht tip on top must not trip it
    const tipped: PaybackFormInput = {
      ...form,
      totalBill: '258',
      tipEnabled: true,
      tipMode: 'amount',
      tipValue: '500',
    }
    expect(errorsOn(tipped, 'totalBill')).toEqual([])
    expect(schema.safeParse(tipped).success).toBe(true)
  })

  it('says nothing about the total while a percentage is unusable', () => {
    const broken = { ...form, totalBill: '200', vatPct: 'abc' }
    expect(errorsOn(broken, 'totalBill')).toEqual([])
    expect(errorsOn(broken, 'vatPct')).toEqual(['numbersOnly'])
  })
})
