import { describe, expect, it } from 'vitest'

import { formatAmount } from '@/shared/lib/money'
import {
  calculateDiscount,
  calculateIncrease,
  calculatePercentageOf,
  calculatePercentageRelation,
} from './percentage'

describe('calculatePercentageOf', () => {
  it('answers the headline case: 80% of 1,500', () => {
    expect(calculatePercentageOf(80, 1500)).toBe(1200)
  })

  it('takes a decimal percentage', () => {
    expect(calculatePercentageOf(12.5, 200)).toBe(25)
  })

  it('takes a decimal amount', () => {
    expect(calculatePercentageOf(10, 999.99)).toBeCloseTo(99.999)
  })

  it('is nothing at 0%', () => {
    expect(calculatePercentageOf(0, 1500)).toBe(0)
  })

  it('is the whole amount at 100%', () => {
    expect(calculatePercentageOf(100, 1500)).toBe(1500)
  })

  it('goes above the amount past 100%', () => {
    // "300% of 50" is an ordinary question, unlike a 300% discount.
    expect(calculatePercentageOf(300, 50)).toBe(150)
  })
})

describe('calculateDiscount', () => {
  it('answers the headline case: 60% off 5,000', () => {
    expect(calculateDiscount(5000, 60)).toEqual({ discount: 3000, final: 2000 })
  })

  it('leaves nothing to pay at 100%', () => {
    expect(calculateDiscount(5000, 100)).toEqual({ discount: 5000, final: 0 })
  })

  it('changes nothing at 0%', () => {
    expect(calculateDiscount(5000, 0)).toEqual({ discount: 0, final: 5000 })
  })

  it('handles decimals in both places', () => {
    const { discount, final } = calculateDiscount(999.99, 7.5)
    expect(discount).toBeCloseTo(74.99925)
    expect(final).toBeCloseTo(924.99075)
  })

  it('always splits the original between what comes off and what is left', () => {
    for (const pct of [0, 7.5, 33.3, 60, 100]) {
      const { discount, final } = calculateDiscount(5000, pct)
      expect(discount + final).toBeCloseTo(5000)
    }
  })
})

describe('calculateIncrease', () => {
  it('answers the headline case: 10% more than 1,000', () => {
    expect(calculateIncrease(1000, 10)).toEqual({ increase: 100, final: 1100 })
  })

  it('changes nothing at 0%', () => {
    expect(calculateIncrease(1000, 0)).toEqual({ increase: 0, final: 1000 })
  })

  it('doubles at 100%', () => {
    expect(calculateIncrease(1000, 100)).toEqual({
      increase: 1000,
      final: 2000,
    })
  })

  it('handles a decimal percentage', () => {
    const { increase, final } = calculateIncrease(1000, 7.5)
    expect(increase).toBeCloseTo(75)
    expect(final).toBeCloseTo(1075)
  })
})

describe('calculatePercentageRelation', () => {
  it('answers the headline case: 800 out of 1,000 is 80%', () => {
    expect(calculatePercentageRelation(800, 1000)).toBe(80)
  })

  it('is 100% when the part is the whole', () => {
    expect(calculatePercentageRelation(1000, 1000)).toBe(100)
  })

  it('goes over 100% when the part is bigger', () => {
    expect(calculatePercentageRelation(1500, 1000)).toBe(150)
  })

  it('is nothing when the part is nothing', () => {
    expect(calculatePercentageRelation(0, 1000)).toBe(0)
  })

  it('refuses to divide by a whole of zero', () => {
    // Every number is an infinite percentage of nothing; 0 beats Infinity
    // leaking into the UI. The form blocks this before it ever gets here.
    expect(calculatePercentageRelation(800, 0)).toBe(0)
  })

  it('handles decimals', () => {
    expect(calculatePercentageRelation(1, 3)).toBeCloseTo(33.3333, 3)
  })
})

describe('floating point, as the user sees it', () => {
  /*
   * The raw arithmetic carries binary-float noise — 70% of 8.1 is not exactly
   * 5.67 in IEEE 754. The display layer rounds to two decimals, which is where
   * that noise is meant to disappear, so these pin the visible answer rather
   * than the internal one.
   */
  it('does not show float noise for a percentage', () => {
    expect(formatAmount(calculatePercentageOf(70, 8.1))).toBe('5.67')
  })

  it('does not show float noise for a discount', () => {
    const { final } = calculateDiscount(0.3, 10)
    expect(formatAmount(final)).toBe('0.27')
  })

  it('drops trailing zeros on a whole answer', () => {
    expect(formatAmount(calculatePercentageOf(80, 1500))).toBe('1,200')
  })

  it('keeps two decimals when there are any', () => {
    expect(formatAmount(1200.5)).toBe('1,200.50')
  })
})
