import { describe, expect, it } from 'vitest'

import { calculateBill } from '@/shared/lib/bill'
import { translations } from '@/i18n/translations'
import {
  chargedTotal,
  createGroupMealSchema,
  toBill,
  type GroupMealFormInput,
} from './schema'

const t = (key: keyof typeof translations.en, params?: Record<string, string | number>) => {
  let text: string = translations.en[key]
  for (const [name, value] of Object.entries(params ?? {})) {
    text = text.replace(`{${name}}`, String(value))
  }
  return text
}

const schema = createGroupMealSchema(t)

/**
 * Three friends out for dinner. The tom yum and the rice went round the table;
 * the steak was Bianca's alone. Alex paid.
 */
function meal(overrides: Partial<GroupMealFormInput> = {}): GroupMealFormInput {
  return {
    people: [
      { id: 'alex', name: 'Alex' },
      { id: 'bianca', name: 'Bianca' },
      { id: 'carlos', name: 'Carlos' },
    ],
    dishes: [
      {
        id: '1',
        title: 'Tom yum',
        price: '300',
        sharedBy: ['alex', 'bianca', 'carlos'],
      },
      {
        id: '2',
        title: 'Rice',
        price: '60',
        sharedBy: ['alex', 'bianca', 'carlos'],
      },
      { id: '3', title: 'Steak', price: '540', sharedBy: ['bianca'] },
    ],
    totalBill: '0',
    serviceChargeEnabled: true,
    serviceChargePct: '10',
    vatEnabled: true,
    vatPct: '7',
    payerId: 'alex',
    ...overrides,
  }
}

function parse(values: GroupMealFormInput) {
  return schema.safeParse(values)
}

/** The issues raised for one field path. */
function issuesFor(values: GroupMealFormInput, path: string): string[] {
  const result = parse(values)
  if (result.success) return []
  return result.error.issues
    .filter((issue) => issue.path.join('.') === path)
    .map((issue) => issue.message)
}

describe('chargedTotal', () => {
  it('puts VAT on the service charge as well as the food', () => {
    // 1000 + 10% = 1100, then 7% on that = 1177, not 1170.
    expect(chargedTotal(1000, 10, 7)).toBeCloseTo(1177)
  })

  it('is just the food when both charges are off', () => {
    expect(chargedTotal(1000, 0, 0)).toBe(1000)
  })
})

describe('group meal schema', () => {
  it('accepts an ordinary dinner', () => {
    expect(parse(meal()).success).toBe(true)
  })

  it('needs at least two people', () => {
    const values = meal({ people: [{ id: 'alex', name: 'Alex' }] })
    expect(issuesFor(values, 'people')).toContain('Add at least two people')
  })

  it('needs at least one dish', () => {
    expect(issuesFor(meal({ dishes: [] }), 'dishes')).toContain(
      'Add at least one dish',
    )
  })

  it('refuses a table where every dish is free', () => {
    const values = meal({
      dishes: [
        { id: '1', title: 'Water', price: '0', sharedBy: ['alex', 'bianca'] },
      ],
    })
    expect(issuesFor(values, 'dishes')).toContain(
      'The dishes must come to more than zero',
    )
  })

  it('refuses a dish nobody ate', () => {
    const values = meal({
      dishes: [{ id: '1', title: 'Tom yum', price: '300', sharedBy: [] }],
    })
    expect(issuesFor(values, 'dishes.0.sharedBy')).toContain(
      'Somebody has to have eaten it',
    )
  })

  it('refuses a dish shared with somebody who left the table', () => {
    const values = meal({
      dishes: [
        { id: '1', title: 'Tom yum', price: '300', sharedBy: ['alex', 'zoe'] },
      ],
    })
    expect(issuesFor(values, 'dishes.0.sharedBy')).toContain(
      'Somebody has to have eaten it',
    )
  })

  it('needs a payer who is at the table', () => {
    expect(issuesFor(meal({ payerId: 'zoe' }), 'payerId')).toContain(
      'Choose who paid',
    )
  })

  it('only validates a charge while its switch is on', () => {
    const broken = { serviceChargePct: 'abc', vatPct: 'abc' }
    expect(issuesFor(meal(broken), 'serviceChargePct')).toContain(
      'Numbers only',
    )

    const off = meal({
      ...broken,
      serviceChargeEnabled: false,
      vatEnabled: false,
    })
    expect(issuesFor(off, 'serviceChargePct')).toEqual([])
    expect(issuesFor(off, 'vatPct')).toEqual([])
  })

  it('zeroes a switched-off charge whatever is left in its box', () => {
    const result = parse(
      meal({ serviceChargeEnabled: false, serviceChargePct: '10' }),
    )
    expect(result.success && result.data.serviceChargePct).toBe(0)
  })

  describe('the total-bill cross-check', () => {
    it('catches dishes that cost more than the bill', () => {
      // 900 of food charged up is 1,059.30 — well over a 500 baht bill.
      const issues = issuesFor(meal({ totalBill: '500' }), 'totalBill')
      expect(issues[0]).toMatch(/1,059\.30/)
    })

    it('passes when the bill matches what was entered', () => {
      expect(parse(meal({ totalBill: '1059.30' })).success).toBe(true)
    })

    it('allows a baht of receipt rounding', () => {
      expect(parse(meal({ totalBill: '1058.50' })).success).toBe(true)
    })

    it('is skipped when the total is left at zero', () => {
      expect(parse(meal({ totalBill: '0' })).success).toBe(true)
    })
  })
})

describe('toBill', () => {
  function billFor(values: GroupMealFormInput = meal()) {
    const parsed = parse(values)
    if (!parsed.success) throw new Error('fixture should parse')
    return toBill(parsed.data)
  }

  it('charges service and VAT in proportion to what each person ate', () => {
    const bill = billFor()
    expect(bill.fees.map((fee) => fee.split)).toEqual([
      'proportional',
      'proportional',
    ])
  })

  it('works VAT out on the food and the service charge together', () => {
    const [service, vat] = billFor().fees
    expect(service.amount).toBeCloseTo(90) // 10% of 900
    expect(vat.amount).toBeCloseTo(69.3) // 7% of 990, not of 900
  })

  it('files every dish under whoever paid, since the bill is theirs', () => {
    const bill = billFor()
    expect(bill.items.every((item) => item.addedBy === 'alex')).toBe(true)
  })

  it('charges the person who ate alone for the whole dish', () => {
    const result = calculateBill(billFor())
    const bianca = result.participants.find(
      (share) => share.participantId === 'bianca',
    )!

    // Her steak at 540, plus a third each of the 300 and the 60.
    expect(bianca.food).toBeCloseTo(660)
  })

  it('adds the shares up to the whole charged bill', () => {
    const result = calculateBill(billFor())
    const total = result.participants.reduce(
      (sum, share) => sum + share.total,
      0,
    )

    expect(total).toBeCloseTo(chargedTotal(900, 10, 7))
    expect(result.grandTotal).toBeCloseTo(1059.3)
  })

  it('leaves the charges out entirely when both are switched off', () => {
    const bill = billFor(
      meal({ serviceChargeEnabled: false, vatEnabled: false }),
    )
    expect(bill.fees.every((fee) => fee.amount === 0)).toBe(true)
    expect(calculateBill(bill).grandTotal).toBeCloseTo(900)
  })
})
