import { describe, expect, it } from 'vitest'

import {
  calculateSplit,
  formatTHB,
  settlementSentence,
  type SplitInput,
} from './calculator'

const base: SplitInput = {
  payer: 'A',
  foodA: 300,
  foodB: 200,
  serviceChargePct: 10,
  vatPct: 7,
}

describe('calculateSplit', () => {
  it('computes the full bill breakdown', () => {
    const r = calculateSplit(base)
    expect(r.foodTotal).toBe(500)
    expect(r.serviceCharge).toBeCloseTo(50, 5) // 500 * 10%
    expect(r.subtotal).toBeCloseTo(550, 5) // 500 + 50
    expect(r.vat).toBeCloseTo(38.5, 5) // 550 * 7%
    expect(r.grandTotal).toBeCloseTo(588.5, 5) // 550 + 38.5
  })

  it('splits payments proportionally to each food amount', () => {
    const r = calculateSplit(base)
    expect(r.ratioA).toBeCloseTo(0.6, 5)
    expect(r.ratioB).toBeCloseTo(0.4, 5)
    expect(r.paymentA).toBeCloseTo(353.1, 5) // 588.5 * 0.6
    expect(r.paymentB).toBeCloseTo(235.4, 5) // 588.5 * 0.4
  })

  it('per-person payments always sum to the grand total', () => {
    const r = calculateSplit(base)
    expect(r.paymentA + r.paymentB).toBeCloseTo(r.grandTotal, 5)
  })

  it('when A pays, B is the debtor and transfers B’s share', () => {
    const r = calculateSplit({ ...base, payer: 'A' })
    expect(r.debtor).toBe('B')
    expect(r.transferAmount).toBeCloseTo(r.paymentB, 5)
  })

  it('when B pays, A is the debtor and transfers A’s share', () => {
    const r = calculateSplit({ ...base, payer: 'B' })
    expect(r.debtor).toBe('A')
    expect(r.transferAmount).toBeCloseTo(r.paymentA, 5)
  })

  it('handles zero service charge and zero VAT', () => {
    const r = calculateSplit({
      ...base,
      serviceChargePct: 0,
      vatPct: 0,
    })
    expect(r.serviceCharge).toBe(0)
    expect(r.vat).toBe(0)
    expect(r.grandTotal).toBe(r.foodTotal)
  })

  it('splits an equal bill evenly', () => {
    const r = calculateSplit({ ...base, foodA: 250, foodB: 250 })
    expect(r.ratioA).toBeCloseTo(0.5, 5)
    expect(r.ratioB).toBeCloseTo(0.5, 5)
    expect(r.paymentA).toBeCloseTo(r.paymentB, 5)
  })
})

describe('formatTHB', () => {
  it('formats with two decimals and a THB suffix', () => {
    expect(formatTHB(493.42)).toBe('493.42 THB')
    expect(formatTHB(1000)).toBe('1,000.00 THB')
    expect(formatTHB(1234.5)).toBe('1,234.50 THB')
    expect(formatTHB(0)).toBe('0.00 THB')
  })
})

describe('settlementSentence', () => {
  it('describes who transfers to whom', () => {
    const r = calculateSplit({ ...base, foodA: 300, foodB: 200, payer: 'A' })
    expect(settlementSentence(r)).toBe(
      `B should transfer ${formatTHB(r.paymentB)} to A`,
    )
  })
})
