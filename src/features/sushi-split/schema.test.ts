import { describe, expect, it } from 'vitest'

import { translations } from '@/i18n/translations'
import type { SushiSession } from './session'
import {
  calculateSushiSplit,
  chargesOf,
  createSushiSchema,
  type ParsedSession,
} from './schema'

const t = (key: keyof typeof translations.en) => translations.en[key]
const schema = createSushiSchema(t)

/**
 * The spec's worked example. Pao had three red, two blue and a green; A had two
 * red and two yellow. At these prices that is ฿280 and ฿220.
 */
function session(overrides: Partial<SushiSession> = {}): SushiSession {
  return {
    restaurantId: 'test',
    restaurantName: 'Test Sushi',
    plates: [
      { id: 'red', label: 'Red', price: '40', color: 'red' },
      { id: 'blue', label: 'Blue', price: '50', color: 'blue' },
      { id: 'green', label: 'Green', price: '60', color: 'green' },
      { id: 'yellow', label: 'Yellow', price: '70', color: 'yellow' },
    ],
    diners: [
      { id: 'pao', name: 'Pao', counts: { red: 3, blue: 2, green: 1 } },
      { id: 'a', name: 'A', counts: { red: 2, yellow: 2 } },
    ],
    serviceChargeEnabled: false,
    serviceChargePct: '10',
    vatEnabled: false,
    vatPct: '7',
    discountKind: 'amount',
    discountValue: '0',
    payerId: 'pao',
    ...overrides,
  }
}

function parse(raw: SushiSession): ParsedSession {
  const result = schema.safeParse(raw)
  if (!result.success) {
    throw new Error(result.error.issues.map((i) => i.message).join(', '))
  }
  return result.data
}

const split = (raw: SushiSession) => calculateSushiSplit(parse(raw))

const shareOf = (raw: SushiSession, id: string) =>
  split(raw).bill.participants.find((p) => p.participantId === id)!

/** Messages raised against one field. */
function issuesAt(raw: unknown, path: string): string[] {
  const result = schema.safeParse(raw)
  if (result.success) return []
  return result.error.issues
    .filter((issue) => issue.path.join('.') === path)
    .map((issue) => issue.message)
}

/** The shares always add back up to the bill, whatever the case. */
function expectReconciles(raw: SushiSession) {
  const { bill, charges } = split(raw)
  const summed = bill.participants.reduce((sum, p) => sum + p.total, 0)
  expect(summed).toBeCloseTo(charges.grandTotal, 10)
  expect(bill.grandTotal).toBeCloseTo(charges.grandTotal, 10)
}

describe('food', () => {
  it('multiplies each plate by this restaurant’s price', () => {
    expect(shareOf(session(), 'pao').food).toBe(280) // 120 + 100 + 60
    expect(shareOf(session(), 'a').food).toBe(220) // 80 + 140
  })

  it('totals the table before any charge is added', () => {
    expect(split(session()).charges.food).toBe(500)
  })

  it('makes the table’s food the sum of everyone’s', () => {
    const { bill, charges } = split(session())
    const summed = bill.participants.reduce((sum, p) => sum + p.food, 0)
    expect(summed).toBe(charges.food)
  })

  it('works with a single plate type', () => {
    const single = session({
      plates: [{ id: 'only', label: 'Plate', price: '35', color: null }],
      diners: [
        { id: 'pao', name: 'Pao', counts: { only: 4 } },
        { id: 'a', name: 'A', counts: { only: 2 } },
      ],
    })
    expect(split(single).charges.food).toBe(210)
  })

  it('charges the same colour differently at different restaurants', () => {
    const elsewhere = session({
      plates: [
        { id: 'red', label: 'Red', price: '50', color: 'red' },
        { id: 'blue', label: 'Blue', price: '60', color: 'blue' },
        { id: 'green', label: 'Green', price: '70', color: 'green' },
        { id: 'yellow', label: 'Yellow', price: '80', color: 'yellow' },
      ],
    })
    // Pao's same plates cost more here: 150 + 120 + 70.
    expect(shareOf(elsewhere, 'pao').food).toBe(340)
  })

  it('accepts custom plate types that are not colours at all', () => {
    const custom = session({
      plates: [
        { id: 'p1', label: 'Pattern A', price: '45', color: null },
        { id: 'p2', label: 'Special', price: '150', color: 'gold' },
      ],
      diners: [
        { id: 'pao', name: 'Pao', counts: { p1: 2, p2: 1 } },
        { id: 'a', name: 'A', counts: { p1: 1 } },
      ],
    })
    expect(split(custom).charges.food).toBe(285)
  })

  it('allows a free plate', () => {
    const free = session({
      plates: [
        { id: 'red', label: 'Red', price: '40', color: 'red' },
        { id: 'free', label: 'Birthday plate', price: '0', color: null },
      ],
      diners: [
        { id: 'pao', name: 'Pao', counts: { red: 1, free: 1 } },
        { id: 'a', name: 'A', counts: { red: 1 } },
      ],
    })
    expect(split(free).charges.food).toBe(80)
  })
})

describe('service charge and VAT', () => {
  it('adds service charge, shared by what each person ate', () => {
    // The spec's example: 10% of 500 is 50, split 28 / 22.
    const withService = session({ serviceChargeEnabled: true })

    expect(split(withService).charges.serviceCharge).toBe(50)
    expect(shareOf(withService, 'a').fees).toBeCloseTo(22)
    expect(shareOf(withService, 'a').total).toBe(242)
    expect(shareOf(withService, 'pao').total).toBe(308)
    expect(split(withService).charges.grandTotal).toBe(550)
  })

  it('adds VAT on its own', () => {
    const vatOnly = session({ vatEnabled: true })
    expect(split(vatOnly).charges.vat).toBeCloseTo(35)
    expect(split(vatOnly).charges.grandTotal).toBeCloseTo(535)
  })

  it('puts VAT on the service charge as well as the food', () => {
    const both = session({ serviceChargeEnabled: true, vatEnabled: true })
    const { serviceCharge, vat, grandTotal } = split(both).charges
    expect(serviceCharge).toBe(50)
    expect(vat).toBeCloseTo(38.5) // 7% of 550
    expect(grandTotal).toBeCloseTo(588.5)
  })

  it('ignores a charge that is switched off, whatever is in its box', () => {
    const off = session({ serviceChargePct: '99', vatPct: '99' })
    expect(split(off).charges.grandTotal).toBe(500)
  })
})

describe('discount', () => {
  /** A ฿1,200 table, so the discount order is easy to see. */
  const big = (overrides: Partial<SushiSession> = {}) =>
    session({
      diners: [
        { id: 'pao', name: 'Pao', counts: { red: 12 } },
        { id: 'a', name: 'A', counts: { red: 18 } },
      ],
      serviceChargeEnabled: true,
      vatEnabled: true,
      discountValue: '100',
      ...overrides,
    })

  it('comes off the food before service charge and VAT', () => {
    const { food, discount, afterDiscount, serviceCharge, vat, grandTotal } =
      split(big()).charges

    expect(food).toBe(1200)
    expect(discount).toBe(100)
    expect(afterDiscount).toBe(1100)
    expect(serviceCharge).toBeCloseTo(110) // on 1,100, not 1,200
    expect(vat).toBeCloseTo(84.7) // on 1,210, not 1,320
    expect(grandTotal).toBeCloseTo(1294.7)
  })

  it('is not taken off at the end', () => {
    // Discount last would charge VAT on money nobody paid: 1,312.40.
    expect(split(big()).charges.grandTotal).not.toBeCloseTo(1312.4, 1)
  })

  it('is shared by what each person ate', () => {
    // 400 and 600 of food, ฿100 off: 40 and 60.
    const plain = session({
      diners: [
        { id: 'pao', name: 'Pao', counts: { red: 10 } },
        { id: 'a', name: 'A', counts: { red: 15 } },
      ],
      discountValue: '100',
    })
    expect(shareOf(plain, 'pao').discount).toBeCloseTo(40)
    expect(shareOf(plain, 'a').discount).toBeCloseTo(60)
    expect(shareOf(plain, 'a').total).toBe(540)
  })

  it('takes a percentage of the food', () => {
    const pct = session({ discountKind: 'percent', discountValue: '10' })
    expect(split(pct).charges.discount).toBe(50)
  })

  it('brings a 100% discount to nothing, and nobody below it', () => {
    const free = big({ discountKind: 'percent', discountValue: '100' })
    const { bill, charges } = split(free)

    expect(charges.grandTotal).toBe(0)
    for (const share of bill.participants) {
      expect(share.total).toBeGreaterThanOrEqual(0)
      expect(share.total).toBe(0)
    }
  })
})

describe('everyone’s share', () => {
  it('gives a lone diner the whole bill', () => {
    const alone = session({
      diners: [{ id: 'pao', name: 'Pao', counts: { red: 3, blue: 2 } }],
      serviceChargeEnabled: true,
      vatEnabled: true,
    })
    const { bill, charges } = split(alone)
    expect(bill.participants).toHaveLength(1)
    expect(bill.participants[0].total).toBeCloseTo(charges.grandTotal)
    expect(bill.transfers).toEqual([])
  })

  it('charges nothing to somebody who ate nothing', () => {
    const hungry = session({
      diners: [
        ...session().diners,
        { id: 'c', name: 'C', counts: {} },
      ],
      serviceChargeEnabled: true,
      vatEnabled: true,
      discountValue: '50',
    })
    const c = shareOf(hungry, 'c')
    expect([c.food, c.fees, c.discount, c.total]).toEqual([0, 0, 0, 0])
  })

  it('splits between several people', () => {
    const four = session({
      diners: [
        { id: 'pao', name: 'Pao', counts: { red: 3 } },
        { id: 'a', name: 'A', counts: { blue: 2 } },
        { id: 'b', name: 'B', counts: { green: 1, yellow: 1 } },
        { id: 'c', name: 'C', counts: { red: 1, blue: 1 } },
      ],
    })
    expect(split(four).bill.participants.map((p) => p.food)).toEqual([
      120, 100, 130, 90,
    ])
  })

  it('rounds to whole Baht, with the payer carrying the change', () => {
    // Three ฿10 plates with 10% and 7% on top: 35.31, which cannot be split
    // three ways evenly in whole Baht.
    const thirds = session({
      plates: [{ id: 'ten', label: 'Ten', price: '10', color: null }],
      diners: [
        { id: 'pao', name: 'Pao', counts: { ten: 1 } },
        { id: 'a', name: 'A', counts: { ten: 1 } },
        { id: 'b', name: 'B', counts: { ten: 1 } },
      ],
      serviceChargeEnabled: true,
      vatEnabled: true,
    })

    expect(shareOf(thirds, 'a').total).toBe(12)
    expect(shareOf(thirds, 'b').total).toBe(12)
    expect(shareOf(thirds, 'pao').total).toBeCloseTo(11.31)
    expectReconciles(thirds)
  })

  it('always adds back up to the grand total', () => {
    expectReconciles(session())
    expectReconciles(session({ serviceChargeEnabled: true, vatEnabled: true }))
    expectReconciles(
      session({
        serviceChargeEnabled: true,
        vatEnabled: true,
        discountKind: 'percent',
        discountValue: '15',
      }),
    )
  })

  it('asks everyone but the payer to transfer', () => {
    const { bill } = split(session())
    expect(bill.transfers).toEqual([{ from: 'a', to: 'pao', amount: 220 }])
  })
})

describe('validation', () => {
  const plates = session().plates
  const diners = session().diners

  it('accepts the worked example', () => {
    expect(schema.safeParse(session()).success).toBe(true)
  })

  it('needs the restaurant named', () => {
    expect(issuesAt(session({ restaurantName: '  ' }), 'restaurantName')).toEqual([
      'Name the restaurant',
    ])
  })

  it('needs at least one plate type', () => {
    expect(issuesAt(session({ plates: [] }), 'plates')).toContain(
      'Add at least one plate type',
    )
  })

  it('needs every plate labelled and priced', () => {
    const bad = session({
      plates: [{ ...plates[0], label: '', price: '' }, ...plates.slice(1)],
    })
    expect(issuesAt(bad, 'plates.0.label')).toContain('Required')
    expect(issuesAt(bad, 'plates.0.price')).toContain('Required')
  })

  it('refuses a negative price', () => {
    const bad = session({ plates: [{ ...plates[0], price: '-40' }, ...plates.slice(1)] })
    expect(issuesAt(bad, 'plates.0.price')).toContain('Cannot be negative')
  })

  it('refuses a negative or fractional plate count', () => {
    const negative = session({
      diners: [{ ...diners[0], counts: { red: -1 } }, diners[1]],
    })
    const fraction = session({
      diners: [{ ...diners[0], counts: { red: 1.5 } }, diners[1]],
    })
    expect(issuesAt(negative, 'diners.0.counts.red')).toContain('Cannot be negative')
    expect(issuesAt(fraction, 'diners.0.counts.red')).toContain('Whole number')
  })

  it('needs everyone named', () => {
    const bad = session({ diners: [{ ...diners[0], name: '' }, diners[1]] })
    expect(issuesAt(bad, 'diners.0.name')).toContain('Required')
  })

  it('needs at least one person', () => {
    expect(issuesAt(session({ diners: [] }), 'diners')).toContain(
      'Add at least one person',
    )
  })

  it('needs somebody to have eaten something', () => {
    const empty = session({
      diners: diners.map((d) => ({ ...d, counts: {} })),
    })
    expect(issuesAt(empty, 'diners')).toContain('Nobody has any plates yet')
  })

  it('refuses two plate types with the same id', () => {
    const dupe = session({ plates: [...plates, { ...plates[0] }] })
    expect(issuesAt(dupe, 'plates')).toContain('Two plate types share an id')
  })

  it('needs a payer who is at the table', () => {
    expect(issuesAt(session({ payerId: 'zoe' }), 'payerId')).toContain(
      'Pick who paid',
    )
  })

  it('refuses a discount bigger than the food', () => {
    expect(issuesAt(session({ discountValue: '501' }), 'discountValue')).toContain(
      'The discount is more than the food',
    )
  })

  it('refuses a percentage discount over 100', () => {
    const bad = session({ discountKind: 'percent', discountValue: '120' })
    expect(issuesAt(bad, 'discountValue')).toContain(
      'A percentage cannot be over 100',
    )
  })

  it('refuses a negative discount', () => {
    expect(issuesAt(session({ discountValue: '-5' }), 'discountValue')).toContain(
      'Cannot be negative',
    )
  })

  it('only checks a charge while it is switched on', () => {
    const blankOn = session({ serviceChargeEnabled: true, serviceChargePct: '' })
    const blankOff = session({ serviceChargeEnabled: false, serviceChargePct: '' })
    expect(issuesAt(blankOn, 'serviceChargePct')).toContain('Required')
    expect(issuesAt(blankOff, 'serviceChargePct')).toEqual([])
  })
})

describe('chargesOf', () => {
  it('reports every step of the bill in the order it was applied', () => {
    const charges = chargesOf(
      parse(session({ serviceChargeEnabled: true, vatEnabled: true, discountValue: '50' })),
    )
    // 500 − 50 = 450, + 45 service, + 7% of 495.
    expect(charges.afterDiscount).toBe(450)
    expect(charges.serviceCharge).toBe(45)
    expect(charges.vat).toBeCloseTo(34.65)
    expect(charges.grandTotal).toBeCloseTo(529.65)
  })
})
