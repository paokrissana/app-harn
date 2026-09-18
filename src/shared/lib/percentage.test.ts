import { describe, expect, it } from 'vitest'

import { formatAmount } from '@/shared/lib/money'
import {
  addVat,
  calculateDiscount,
  calculateTip,
  calculateIncrease,
  calculatePercentageOf,
  calculatePercentageRelation,
  removeVat,
  restaurantCharges,
} from '@/shared/lib/percentage'

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

describe('addVat', () => {
  it('puts 7% on a net price', () => {
    expect(addVat(100, 7)).toEqual({ vat: 7, total: 107 })
  })

  it('changes nothing at 0%', () => {
    expect(addVat(100, 0)).toEqual({ vat: 0, total: 100 })
  })
})

describe('removeVat', () => {
  it('takes VAT back out of a price that includes it', () => {
    const { net, vat } = removeVat(107, 7)
    expect(net).toBeCloseTo(100)
    expect(vat).toBeCloseTo(7)
  })

  it('is not the same as subtracting the percentage', () => {
    /*
     * The mistake this calculator exists to prevent. VAT was charged on the
     * smaller number, so coming back means dividing by 1.07 — subtracting 7%
     * lands 49 satang low on a 107 baht bill, and further out as it grows.
     */
    const { net } = removeVat(107, 7)
    const wrong = 107 - (107 * 7) / 100

    expect(net).toBeCloseTo(100)
    expect(wrong).toBeCloseTo(99.51)
    expect(net).not.toBeCloseTo(wrong, 1)
  })

  it('round-trips with addVat', () => {
    for (const gross of [107, 1070, 53.5, 999.99]) {
      const { net } = removeVat(gross, 7)
      expect(addVat(net, 7).total).toBeCloseTo(gross)
    }
  })

  it('leaves the price alone at 0%', () => {
    expect(removeVat(100, 0)).toEqual({ net: 100, vat: 0 })
  })
})

describe('restaurantCharges', () => {
  it('puts VAT on the service charge as well as the food', () => {
    // 1,000 + 10% = 1,100, then 7% of that = 1,177 — not 1,170.
    const { serviceCharge, vat, total } = restaurantCharges(1000, 10, 7)
    expect(serviceCharge).toBe(100)
    expect(vat).toBeCloseTo(77)
    expect(total).toBeCloseTo(1177)
  })

  it('is not a single combined percentage', () => {
    const combined = 1000 * 1.17
    expect(restaurantCharges(1000, 10, 7).total).not.toBeCloseTo(combined, 1)
  })

  it('is just the subtotal when neither charge applies', () => {
    expect(restaurantCharges(1000, 0, 0)).toEqual({
      serviceCharge: 0,
      vat: 0,
      total: 1000,
    })
  })

  it('handles VAT only, for a place with no service charge', () => {
    expect(restaurantCharges(1000, 0, 7).total).toBeCloseTo(1070)
  })
})

describe('calculateTip', () => {
  it('adds a tip to a bill', () => {
    expect(calculateTip(1000, 10)).toEqual({ tip: 100, total: 1100, each: 1100 })
  })

  it('splits the total between people', () => {
    const { each } = calculateTip(1000, 10, 4)
    expect(each).toBeCloseTo(275)
  })

  it('treats a nonsense headcount as one', () => {
    // A bill split zero ways has no answer; the whole total beats Infinity.
    expect(calculateTip(1000, 10, 0).each).toBe(1100)
    expect(calculateTip(1000, 10, -3).each).toBe(1100)
  })

  it('ignores a fractional headcount', () => {
    expect(calculateTip(1000, 10, 2.9).each).toBeCloseTo(550)
  })

  it('still answers with no tip at all', () => {
    expect(calculateTip(1000, 0, 2)).toEqual({ tip: 0, total: 1000, each: 500 })
  })
})
