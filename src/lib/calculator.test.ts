import { describe, expect, it } from 'vitest'

import {
  calculatePayback,
  formatTHB,
  shareOfPlate,
  sumPlates,
  sumSharedPlates,
  type PaybackInput,
} from './calculator'

const base: PaybackInput = {
  totalBill: 1177,
  items: [
    { name: 'Pad Thai', price: 180 },
    { name: 'Coke', price: 40 },
  ],
  sharedItems: [],
  serviceChargePct: 10,
  vatPct: 7,
}

describe('sumPlates', () => {
  it('adds up plate prices', () => {
    expect(sumPlates(base.items)).toBe(220)
  })

  it('is zero for an empty list', () => {
    expect(sumPlates([])).toBe(0)
  })
})

describe('shareOfPlate', () => {
  it('splits a dish evenly across sharers', () => {
    expect(shareOfPlate({ name: 'Nachos', price: 300, shares: 4 })).toBe(75)
  })

  it('is zero when shares is zero (guards divide-by-zero)', () => {
    expect(shareOfPlate({ name: 'x', price: 300, shares: 0 })).toBe(0)
  })
})

describe('sumSharedPlates', () => {
  it('sums the user’s slice across shared dishes', () => {
    const shared = sumSharedPlates([
      { name: 'Nachos', price: 300, shares: 4 }, // 75
      { name: 'Wine', price: 400, shares: 2 }, // 200
    ])
    expect(shared).toBe(275)
  })
})

describe('calculatePayback', () => {
  it('adds service charge and VAT on top of the user’s plates', () => {
    const r = calculatePayback(base)
    expect(r.yourOwnFood).toBe(220)
    expect(r.yourSharedFood).toBe(0)
    expect(r.yourFood).toBe(220)
    expect(r.serviceCharge).toBeCloseTo(22, 5) // 220 * 10%
    expect(r.subtotal).toBeCloseTo(242, 5)
    expect(r.vat).toBeCloseTo(16.94, 5) // 242 * 7%
    expect(r.youPay).toBeCloseTo(258.94, 5)
  })

  it('includes the user’s slice of shared plates in the food total', () => {
    const r = calculatePayback({
      ...base,
      sharedItems: [{ name: 'Nachos', price: 300, shares: 4 }], // +75
    })
    expect(r.yourOwnFood).toBe(220)
    expect(r.yourSharedFood).toBe(75)
    expect(r.yourFood).toBe(295)
    expect(r.serviceCharge).toBeCloseTo(29.5, 5) // 295 * 10%
    expect(r.subtotal).toBeCloseTo(324.5, 5)
    expect(r.vat).toBeCloseTo(22.715, 4) // 324.5 * 7%
    expect(r.youPay).toBeCloseTo(347.215, 4)
  })

  it('passes the total bill through untouched (reference only)', () => {
    expect(calculatePayback(base).totalBill).toBe(1177)
  })

  it('pays exactly the food when there is no service charge or VAT', () => {
    const r = calculatePayback({ ...base, serviceChargePct: 0, vatPct: 0 })
    expect(r.serviceCharge).toBe(0)
    expect(r.vat).toBe(0)
    expect(r.youPay).toBe(r.yourFood)
  })

  it('applies both charges when the toggles are omitted', () => {
    const r = calculatePayback(base)
    expect(r.serviceChargeApplied).toBe(true)
    expect(r.vatApplied).toBe(true)
  })

  it('skips service charge when its toggle is off, but still charges VAT', () => {
    const r = calculatePayback({ ...base, serviceChargeEnabled: false })
    expect(r.serviceChargeApplied).toBe(false)
    expect(r.serviceCharge).toBe(0)
    expect(r.subtotal).toBe(220)
    expect(r.vat).toBeCloseTo(15.4, 5) // 220 * 7%
    expect(r.youPay).toBeCloseTo(235.4, 5)
  })

  it('skips VAT when its toggle is off, but still charges service', () => {
    const r = calculatePayback({ ...base, vatEnabled: false })
    expect(r.vatApplied).toBe(false)
    expect(r.serviceCharge).toBeCloseTo(22, 5)
    expect(r.vat).toBe(0)
    expect(r.youPay).toBeCloseTo(242, 5)
  })

  it('pays the bare food total with both toggles off', () => {
    const r = calculatePayback({
      ...base,
      serviceChargeEnabled: false,
      vatEnabled: false,
    })
    expect(r.youPay).toBe(220)
  })

  it('ignores the percentages entirely while a charge is switched off', () => {
    const r = calculatePayback({
      ...base,
      serviceChargeEnabled: false,
      serviceChargePct: 99,
      vatEnabled: false,
      vatPct: 99,
    })
    expect(r.youPay).toBe(r.yourFood)
  })
})

describe('formatTHB', () => {
  it('formats with two decimals and a THB suffix', () => {
    expect(formatTHB(258.94)).toBe('258.94 THB')
    expect(formatTHB(1000)).toBe('1,000.00 THB')
    expect(formatTHB(0)).toBe('0.00 THB')
  })
})
