import { beforeEach, describe, expect, it } from 'vitest'

import type { PaybackInput } from './calculator'
import {
  MAX_RECORDS,
  addRecord,
  formatDateTime,
  loadHistory,
  recordTotal,
  removeRecord,
  saveHistory,
  suggestBillName,
  updateRecord,
  type BillRecord,
} from './history'

const input: PaybackInput = {
  totalBill: 1177,
  items: [{ name: 'Pad Thai', price: 220 }],
  sharedItems: [],
  serviceChargeEnabled: true,
  serviceChargePct: 10,
  vatEnabled: true,
  vatPct: 7,
}

const jan1 = new Date('2026-01-01T12:00:00.000Z')
const jan2 = new Date('2026-01-02T12:00:00.000Z')

beforeEach(() => {
  localStorage.clear()
})

describe('addRecord', () => {
  it('puts the newest bill first and stamps both dates', () => {
    const [record] = addRecord([], input, 'Somtam Der', jan1)

    expect(record.name).toBe('Somtam Der')
    expect(record.createdAt).toBe(jan1.toISOString())
    expect(record.updatedAt).toBe(record.createdAt)
    expect(record.input).toEqual(input)
  })

  it('keeps later bills at the front', () => {
    const records = addRecord(addRecord([], input, 'First', jan1), input, 'Second', jan2)
    expect(records.map((r) => r.name)).toEqual(['Second', 'First'])
  })

  it('gives each bill its own id', () => {
    const records = addRecord(addRecord([], input, 'First'), input, 'Second')
    expect(records[0].id).not.toBe(records[1].id)
  })

  it('drops the oldest bill once the cap is reached', () => {
    let records: BillRecord[] = []
    for (let i = 0; i < MAX_RECORDS + 5; i++) {
      records = addRecord(records, input, `Bill ${i}`)
    }

    expect(records).toHaveLength(MAX_RECORDS)
    expect(records[0].name).toBe(`Bill ${MAX_RECORDS + 4}`)
    expect(records.at(-1)?.name).toBe('Bill 5')
  })
})

describe('updateRecord', () => {
  it('overwrites in place, keeping the original date', () => {
    const records = addRecord([], input, 'Lunch', jan1)
    const edited = updateRecord(
      records,
      records[0].id,
      { ...input, vatEnabled: false },
      'Lunch, no VAT',
      jan2,
    )

    expect(edited).toHaveLength(1)
    expect(edited[0].id).toBe(records[0].id)
    expect(edited[0].name).toBe('Lunch, no VAT')
    expect(edited[0].createdAt).toBe(jan1.toISOString())
    expect(edited[0].updatedAt).toBe(jan2.toISOString())
    expect(edited[0].input.vatEnabled).toBe(false)
  })

  it('leaves other bills alone', () => {
    const records = addRecord(addRecord([], input, 'First'), input, 'Second')
    const edited = updateRecord(records, records[0].id, input, 'Renamed')
    expect(edited[1]).toEqual(records[1])
  })
})

describe('removeRecord', () => {
  it('deletes just the one bill', () => {
    const records = addRecord(addRecord([], input, 'First'), input, 'Second')
    const left = removeRecord(records, records[0].id)

    expect(left).toHaveLength(1)
    expect(left[0].name).toBe('First')
  })
})

describe('recordTotal', () => {
  it('recomputes what was paid from the stored inputs', () => {
    const [record] = addRecord([], input, 'Lunch')
    expect(recordTotal(record)).toBeCloseTo(258.94, 5) // 220 + 10% + 7%
  })

  it('follows the charge toggles that were saved with the bill', () => {
    const [record] = addRecord(
      [],
      { ...input, serviceChargeEnabled: false, vatEnabled: false },
      'Street food',
    )
    expect(recordTotal(record)).toBe(220)
  })
})

describe('suggestBillName', () => {
  it('uses the first named dish', () => {
    expect(suggestBillName([{ name: 'Pad Thai' }], [], 'Bill')).toBe('Pad Thai')
  })

  it('counts everything else ordered', () => {
    const name = suggestBillName(
      [{ name: 'Pad Thai' }, { name: 'Coke' }],
      [{ name: 'Nachos' }],
      'Bill',
    )
    expect(name).toBe('Pad Thai +2')
  })

  it('skips unnamed dishes to find one with a name', () => {
    expect(suggestBillName([{ name: '  ' }, { name: 'Coke' }], [], 'Bill')).toBe(
      'Coke +1',
    )
  })

  it('falls back when nothing is named', () => {
    expect(suggestBillName([{ name: '' }], [], 'Bill')).toBe('Bill')
    expect(suggestBillName([], [], 'Bill')).toBe('Bill')
  })
})

describe('loadHistory / saveHistory', () => {
  it('round-trips the saved bills', () => {
    const records = addRecord([], input, 'Lunch', jan1)
    saveHistory(records)

    expect(loadHistory()).toEqual(records)
  })

  it('is empty when nothing was ever saved', () => {
    expect(loadHistory()).toEqual([])
  })

  it('ignores corrupt storage rather than throwing', () => {
    localStorage.setItem('bill-history', 'not json{')
    expect(loadHistory()).toEqual([])
  })

  it('ignores history written by a different version', () => {
    localStorage.setItem(
      'bill-history',
      JSON.stringify({ version: 99, records: addRecord([], input, 'Lunch') }),
    )
    expect(loadHistory()).toEqual([])
  })

  it('drops entries that are not bills', () => {
    const good = addRecord([], input, 'Lunch')
    localStorage.setItem(
      'bill-history',
      JSON.stringify({ version: 1, records: [...good, { id: 'x' }, null] }),
    )
    expect(loadHistory()).toEqual(good)
  })
})

describe('formatDateTime', () => {
  it('formats day, month and time', () => {
    expect(formatDateTime('2026-01-02T09:30:00.000Z', 'en')).toMatch(/2 Jan/)
  })

  it('returns nothing for an unreadable date', () => {
    expect(formatDateTime('nonsense', 'en')).toBe('')
  })
})
