import { describe, expect, it } from 'vitest'

import {
  calculateJourney,
  fareFor,
  meterFare,
  segmentsOf,
  stillAboard,
  type Journey,
} from './journey'

/**
 * The journey the spec is written around.
 *
 * A, B and C set off with the meter at 35. B gets out at 145, A at 245, and C
 * rides to 335. So the three of them share 110, then A and C share 100, then C
 * pays the last 90 alone.
 */
const ride: Journey = {
  passengers: [
    { id: 'a', name: 'A' },
    { id: 'b', name: 'B' },
    { id: 'c', name: 'C' },
  ],
  startMeter: 35,
  drops: [
    { passengerId: 'b', meter: 145 },
    { passengerId: 'a', meter: 245 },
  ],
  endMeter: 335,
  fees: [],
  payerId: 'c',
}

const totalFor = (journey: Journey, id: string) =>
  calculateJourney(journey).passengers.find(
    (share) => share.passengerId === id,
  )!.total

describe('segmentsOf', () => {
  it('breaks the ride at every drop', () => {
    expect(segmentsOf(ride).map((s) => [s.from, s.to, s.fare])).toEqual([
      [35, 145, 110],
      [145, 245, 100],
      [245, 335, 90],
    ])
  })

  it('empties the car one passenger at a time', () => {
    expect(segmentsOf(ride).map((s) => s.aboard)).toEqual([
      ['a', 'b', 'c'],
      ['a', 'c'],
      ['c'],
    ])
  })

  it('divides each stretch by who was in it', () => {
    const [first, second, third] = segmentsOf(ride)
    expect(first.each).toBeCloseTo(110 / 3)
    expect(second.each).toBe(50)
    expect(third.each).toBe(90)
  })

  it('keeps a stretch where the meter did not move', () => {
    // Two people out at the same place: an ordinary thing, and hiding the step
    // would make the breakdown stop matching the journey.
    const together: Journey = {
      ...ride,
      drops: [
        { passengerId: 'b', meter: 145 },
        { passengerId: 'a', meter: 145 },
      ],
    }
    const segments = segmentsOf(together)
    expect(segments).toHaveLength(3)
    expect(segments[1]).toMatchObject({ fare: 0, each: 0, aboard: ['a', 'c'] })
  })
})

describe('the fare each passenger owes', () => {
  it('charges only for the stretches they were aboard for', () => {
    const segments = segmentsOf(ride)
    expect(fareFor('b', segments)).toBeCloseTo(110 / 3)
    expect(fareFor('a', segments)).toBeCloseTo(110 / 3 + 50)
    expect(fareFor('c', segments)).toBeCloseTo(110 / 3 + 50 + 90)
  })

  it('adds up to the whole meter', () => {
    const segments = segmentsOf(ride)
    const summed = ['a', 'b', 'c'].reduce(
      (sum, id) => sum + fareFor(id, segments),
      0,
    )
    expect(summed).toBeCloseTo(meterFare(ride))
  })

  it('gives the whole fare to a lone passenger', () => {
    const alone: Journey = {
      ...ride,
      passengers: [{ id: 'a', name: 'A' }],
      drops: [],
      payerId: 'a',
    }
    expect(totalFor(alone, 'a')).toBe(300)
  })

  it('leaves the later stretches to whoever stayed on', () => {
    const early: Journey = {
      ...ride,
      passengers: [
        { id: 'a', name: 'A' },
        { id: 'b', name: 'B' },
      ],
      drops: [{ passengerId: 'b', meter: 35 }],
      payerId: 'a',
    }
    // B left before the meter moved, so A carries all 300.
    expect(totalFor(early, 'b')).toBe(0)
    expect(totalFor(early, 'a')).toBe(300)
  })
})

describe('calculateJourney', () => {
  it('splits the spec journey the way the meter implies', () => {
    const result = calculateJourney(ride)

    expect(result.meterFare).toBe(300)
    expect(result.grandTotal).toBe(300)
    // B 36.67, A 86.67, C 176.67 — rounded, with C carrying the change.
    expect(totalFor(ride, 'b')).toBe(37)
    expect(totalFor(ride, 'a')).toBe(87)
    expect(totalFor(ride, 'c')).toBe(176)
  })

  it('always adds the shares up to what was paid', () => {
    const result = calculateJourney(ride)
    const summed = result.passengers.reduce(
      (sum, share) => sum + share.total,
      0,
    )
    expect(summed).toBe(result.grandTotal)
  })

  it('asks the others to transfer, and never the payer', () => {
    const { transfers } = calculateJourney(ride)
    expect(transfers.map((t) => t.from).sort()).toEqual(['a', 'b'])
    expect(transfers.every((t) => t.to === 'c')).toBe(true)
  })

  it('handles decimal meter readings', () => {
    const decimals: Journey = { ...ride, startMeter: 35.5, endMeter: 335.25 }
    const result = calculateJourney(decimals)
    expect(result.meterFare).toBeCloseTo(299.75)
    const summed = result.passengers.reduce((s, p) => s + p.total, 0)
    expect(summed).toBeCloseTo(result.grandTotal)
  })

  it('does not fall over without passengers', () => {
    const nobody: Journey = { ...ride, passengers: [], drops: [], payerId: 'a' }
    expect(calculateJourney(nobody).passengers).toEqual([])
  })
})

describe('tolls and extras', () => {
  const withFee = (split: 'everyone' | 'remaining'): Journey => ({
    ...ride,
    fees: [{ id: 'f', label: 'toll', amount: 60, split }],
  })

  it('divides a toll among everyone who rode', () => {
    const result = calculateJourney(withFee('everyone'))
    for (const share of result.passengers) expect(share.fees).toBeCloseTo(20)
  })

  it('leaves parking to whoever was still in the car', () => {
    const result = calculateJourney(withFee('remaining'))
    const fees = (id: string) =>
      result.passengers.find((p) => p.passengerId === id)!.fees

    expect(fees('c')).toBeCloseTo(60)
    expect(fees('a')).toBe(0)
    expect(fees('b')).toBe(0)
  })

  it('counts the fees into the total and still reconciles', () => {
    const result = calculateJourney(withFee('everyone'))
    expect(result.feesTotal).toBe(60)
    expect(result.grandTotal).toBe(360)

    const summed = result.passengers.reduce((s, p) => s + p.total, 0)
    expect(summed).toBe(360)
  })

  it('adds several fees of different kinds', () => {
    const journey: Journey = {
      ...ride,
      fees: [
        { id: 'toll', label: 'toll', amount: 60, split: 'everyone' },
        { id: 'park', label: 'parking', amount: 40, split: 'remaining' },
      ],
    }
    const result = calculateJourney(journey)
    expect(result.grandTotal).toBe(400)

    const c = result.passengers.find((p) => p.passengerId === 'c')!
    expect(c.fees).toBeCloseTo(20 + 40)
  })
})

describe('stillAboard', () => {
  it('is whoever never got out', () => {
    expect(stillAboard(ride)).toEqual(['c'])
  })

  it('is everybody when nobody left', () => {
    expect(stillAboard({ ...ride, drops: [] })).toEqual(['a', 'b', 'c'])
  })
})
